import {readFileSync, mkdirSync, writeFileSync, rmSync} from 'fs'
import {join} from 'path'
import {compile, registerHelper} from 'handlebars'
import {ElementCompact, xml2js} from 'xml-js'

registerHelper('ifnoteq', function(arg1, arg2, options) {
    return arg1 !== arg2 ? options.fn(this) : options.inverse(this)
})

registerHelper('toString', function(x) {
    return '' + x
})

const XSD2TS: {[xsdType: string]: string} = {
    'xs:IDREF': 'ISOXMLReference',
    'xs:ID': 'string',
    'xs:string': 'string',
    'xs:NMTOKEN': 'string',
    'xs:token': 'string',
    'xs:unsignedByte': 'number',
    'xs:long': 'number',
    'xs:unsignedShort': 'number',
    'xs:unsignedLong': 'number',
    'xs:decimal': 'number',
    'xs:double': 'number',
    'xs:hexBinary': 'string',
    'xs:dateTime': 'string',
    'xs:anyURI': 'string',
    'xs:language': 'string'
}

function capitalize(word: string): string {
    return word[0].toUpperCase() + word.slice(1)
}

function normalizeEnumValue (text: string): string {
    const normalizedSpaces = text.toString()
        .replace(/[,()-.]/g, ' ')
        .replace('+', 'Plus')
        .replace(/\s+/g, ' ')
        .trim()

    return normalizedSpaces.split(' ').map(capitalize).join('')
}

function normalizeText (text: string): string {
    return text.toString().trim().replace(/\s+/g, '')
}


const entityTemplate = compile(
    readFileSync('./generation/templates/Entity.hbs', 'utf-8'
))
const indexTemplate = compile(
    readFileSync('./generation/templates/index.hbs', 'utf-8'
))

const constantsTemplate = compile(
    readFileSync('./generation/templates/constants.hbs', 'utf-8'
))

function parseClassesFromFile(filename: string): any[] {
    const schema = xml2js(
        readFileSync(filename, 'utf-8'), 
        {compact: true, alwaysArray: true}
    ) as ElementCompact

    const elements = schema['xs:schema'][0]['xs:element']

    const tags = elements.map((elem: ElementCompact) => {
        const tag = elem._attributes?.name
        const name = normalizeText(elem['xs:annotation'][0]['xs:documentation'][0]._text)

        const attributes = (elem['xs:complexType'][0]['xs:attribute'] || []).map((attr: ElementCompact) => {
            try {
                const xmlName = attr._attributes?.name
                const attrName = attr['xs:annotation']
                    ? normalizeText(attr['xs:annotation'][0]['xs:documentation'][0]._text)
                    : xmlName

                const isOptional = attr._attributes?.use === 'optional'

                let xsdType: string

                let restrictions
                if (attr._attributes?.type) {
                    xsdType = attr._attributes?.type as string
                } else {
                    restrictions = 
                        attr['xs:simpleType'][0]['xs:restriction'] ||
                        attr['xs:simpleType'][0]['xs:union'][0]['xs:simpleType'][0]['xs:restriction']
                    xsdType = restrictions[0]._attributes.base
                }

                if (!xsdType) {
                    console.log('missing type definition', tag, attr)
                    return
                }

                if (!(xsdType in XSD2TS)) {
                    console.log('Unknown type', xsdType)
                }

                let typeEnum = null
                if (xsdType === 'xs:NMTOKEN') {
                    typeEnum = restrictions[0]['xs:enumeration'].map(enumElem => {
                        const value = enumElem._attributes.value
                        return {
                            value,
                            name: enumElem['xs:annotation']
                                ? normalizeEnumValue(enumElem['xs:annotation'][0]['xs:documentation'][0]._text)
                                : `Value${value}`
                        }
                    })
                    // detect duplicate names
                    const namesCount = {}
                    typeEnum.forEach(item => {
                        namesCount[item.name] = (namesCount[item.name] || 0) + 1
                    })

                    typeEnum.forEach(item => {
                        if (namesCount[item.name] > 1) {
                            item.name += item.value
                        }
                    })
                }

                const isPrimaryId = xsdType === 'xs:ID' && attrName === `${name}Id`

                const type = XSD2TS[xsdType]
                return {xmlName, name: attrName, type, xsdType, isOptional, isPrimaryId, typeEnum}
            } catch (e) {
                console.log('Error parsing attribute', attr, elem)
                console.log(e)
            }
        }).filter((e: any) => e)

        let children = []

        if (elem['xs:complexType'][0]['xs:choice'] && elem['xs:complexType'][0]['xs:choice'][0]['xs:element']) {
            children = elem['xs:complexType'][0]['xs:choice'][0]['xs:element'].map((children: ElementCompact) => {
                const name = children['xs:annotation'] && children['xs:annotation'][0]['xs:documentation']
                    ? normalizeText(children['xs:annotation'][0]['xs:documentation'][0]._text)
                    : null
                return {tag: children._attributes?.ref, name}
            })
        }

        return {
            tag, name, attributes, children,
            includeReference: !!attributes.find(attr => attr.type === 'ISOXMLReference')
        }
    })

    return tags
}


const tags = [
    ...parseClassesFromFile('./generation/xsd/ISO11783_Common_V4-3.xsd'),
    ...parseClassesFromFile('./generation/xsd/ISO11783_TaskFile_V4-3.xsd'),
    ...parseClassesFromFile('./generation/xsd/ISO11783_LinkListFile_V4-3.xsd'),
    ...parseClassesFromFile('./generation/xsd/ISO11783_ExternalFile_V4-3.xsd')
]

rmSync('./src/baseEntities', {recursive: true, force: true})
mkdirSync('./src/baseEntities', {recursive: true})

tags.forEach(tag => {
    tag.children.forEach(child => {
        child.className = tags.find(tag => tag.tag === child.tag).name
        if (!child.name) {
            console.log(`Missing child name: ${tag.tag}->${child.tag}`)
            child.name = child.className
        }
    })
})

tags.forEach((tag: any) => {
    const classDefinition = entityTemplate(tag)
    writeFileSync(join('src/baseEntities', `${tag.name}.ts`), classDefinition)
})

writeFileSync('src/baseEntities/index.ts', indexTemplate({tags}))
writeFileSync('src/baseEntities/constants.ts', constantsTemplate({tags}))