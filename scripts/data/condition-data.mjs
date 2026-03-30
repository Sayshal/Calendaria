/**
 * Data models for the unified condition engine's polymorphic condition tree.
 * @module Data/ConditionData
 * @author Tyler
 */

import { CONDITION_FIELDS, CONDITION_GROUP_MODES, CONDITION_OPERATORS } from '../constants.mjs';

const fields = foundry.data.fields;

/**
 * Base data model for condition tree entries.
 */
export class BaseConditionData extends foundry.abstract.DataModel {
  /**
   * Registry of condition entry types for TypedSchemaField.
   * @type {object}
   */
  static get TYPES() {
    return (BaseConditionData.#TYPES ??= Object.freeze({
      [ConditionData.TYPE]: ConditionData,
      [ConditionGroupData.TYPE]: ConditionGroupData
    }));
  }

  static #TYPES;

  /** @type {string} */
  static TYPE = '';

  /** @override */
  static defineSchema() {
    return {
      type: new fields.StringField({
        required: true,
        blank: false,
        initial: this.TYPE,
        validate: (value) => value === this.TYPE,
        validationError: `must be equal to "${this.TYPE}"`
      })
    };
  }
}

/**
 * Data model for a single flat condition (field + operator + value).
 */
export class ConditionData extends BaseConditionData {
  static {
    Object.defineProperty(this, 'TYPE', { value: 'condition' });
  }

  /** @override */
  static defineSchema() {
    return Object.assign(super.defineSchema(), {
      field: new fields.StringField({ required: true, blank: false, choices: Object.values(CONDITION_FIELDS) }),
      op: new fields.StringField({ required: true, choices: Object.values(CONDITION_OPERATORS), initial: '==' }),
      value: new fields.JSONField({ required: true }),
      value2: new fields.JSONField({ nullable: true }),
      offset: new fields.NumberField({ integer: true, initial: 0 })
    });
  }
}

/**
 * Data model for a condition group (boolean logic container).
 */
export class ConditionGroupData extends BaseConditionData {
  static {
    Object.defineProperty(this, 'TYPE', { value: 'group' });
  }

  /** @override */
  static defineSchema() {
    return Object.assign(super.defineSchema(), {
      mode: new fields.StringField({ required: true, blank: false, choices: Object.values(CONDITION_GROUP_MODES), initial: 'and' }),
      threshold: new fields.NumberField({ integer: true, min: 1, nullable: true }),
      children: new fields.ArrayField(new fields.ObjectField(), { initial: [] })
    });
  }
}
