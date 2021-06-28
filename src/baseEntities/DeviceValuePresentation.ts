import { ElementCompact } from 'xml-js'

import { TAGS } from './constants'
import { ISOXMLManager } from '../ISOXMLManager'
import { registerEntityClass } from '../classRegistry'
import { fromXML, toXML } from '../utils'

import { Entity, EntityConstructor, AttributesDescription } from '../types'


export type DeviceValuePresentationAttributes = {
    DeviceValuePresentationObjectId: number
    Offset: number
    Scale: number
    NumberOfDecimals: number
    UnitDesignator?: string
}

const ATTRIBUTES: AttributesDescription = {
    A: { name: 'DeviceValuePresentationObjectId', type: 'xs:unsignedShort', isPrimaryId: false },
    B: { name: 'Offset', type: 'xs:long', isPrimaryId: false },
    C: { name: 'Scale', type: 'xs:decimal', isPrimaryId: false },
    D: { name: 'NumberOfDecimals', type: 'xs:unsignedByte', isPrimaryId: false },
    E: { name: 'UnitDesignator', type: 'xs:string', isPrimaryId: false },
}
const CHILD_TAGS = {
}

export class DeviceValuePresentation implements Entity {
    public tag = TAGS.DeviceValuePresentation

    constructor(public attributes: DeviceValuePresentationAttributes, public isoxmlManager: ISOXMLManager) {
    }

    static fromXML(xml: ElementCompact, isoxmlManager: ISOXMLManager, targetClass: EntityConstructor = DeviceValuePresentation): Entity {
        return fromXML(xml, isoxmlManager, targetClass, ATTRIBUTES, CHILD_TAGS)
    }

    toXML(): ElementCompact {
        return toXML(this, ATTRIBUTES, CHILD_TAGS)
    }
}

registerEntityClass(TAGS.DeviceValuePresentation, DeviceValuePresentation)