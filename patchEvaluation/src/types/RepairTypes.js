/**
 * Repair Type Enum
 * 修正タイプの分類（評価メタデータ用）
 */

export const RepairType = {
    // 構文・局所修正
    CONDITIONAL_CHANGE: 'CONDITIONAL_CHANGE',
    LOOP_CHANGE: 'LOOP_CHANGE',
    FUNCTION_SIGNATURE_CHANGE: 'FUNCTION_SIGNATURE_CHANGE',
    VARIABLE_ADDITION: 'VARIABLE_ADDITION',
    VARIABLE_REMOVAL: 'VARIABLE_REMOVAL',
    
    // API / スキーマ
    SCHEMA_EVOLUTION: 'SCHEMA_EVOLUTION',
    SERIALIZATION_UPDATE: 'SERIALIZATION_UPDATE',
    INTERFACE_ADAPTATION: 'INTERFACE_ADAPTATION',
    
    // 振る舞い
    LOGIC_FIX: 'LOGIC_FIX',
    ERROR_HANDLING_CHANGE: 'ERROR_HANDLING_CHANGE',
    VALIDATION_ADDITION: 'VALIDATION_ADDITION',
    
    // 構造・依存
    IMPORT_DEPENDENCY_CHANGE: 'IMPORT_DEPENDENCY_CHANGE',
    CONFIGURATION_CHANGE: 'CONFIGURATION_CHANGE',
    
    // テスト
    TEST_ADDITION: 'TEST_ADDITION',
    TEST_ADAPTATION: 'TEST_ADAPTATION',
    
    // APR特有
    NO_OP_DEFERRED: 'NO_OP_DEFERRED',
    PARTIAL_REPAIR: 'PARTIAL_REPAIR',
    MULTI_STAGE_REPAIR: 'MULTI_STAGE_REPAIR'
};

/**
 * 修正タイプの説明
 */
export const RepairTypeDescriptions = {
    [RepairType.CONDITIONAL_CHANGE]: 'Modification to conditional statements (if, else, switch, case)',
    [RepairType.LOOP_CHANGE]: 'Modification to loop structures (for, while, foreach)',
    [RepairType.FUNCTION_SIGNATURE_CHANGE]: 'Changes to function/method signatures or parameters',
    [RepairType.VARIABLE_ADDITION]: 'Addition of new variables or fields',
    [RepairType.VARIABLE_REMOVAL]: 'Removal of existing variables or fields',
    
    [RepairType.SCHEMA_EVOLUTION]: 'Changes to data schema (proto, database schema)',
    [RepairType.SERIALIZATION_UPDATE]: 'Updates to serialization/deserialization logic (e.g., pb.go, marshalling)',
    [RepairType.INTERFACE_ADAPTATION]: 'Adaptation to API or interface boundary changes',
    
    [RepairType.LOGIC_FIX]: 'Fixes to core business logic or algorithms',
    [RepairType.ERROR_HANDLING_CHANGE]: 'Changes to error handling or exception management',
    [RepairType.VALIDATION_ADDITION]: 'Addition of input validation or preconditions',
    
    [RepairType.IMPORT_DEPENDENCY_CHANGE]: 'Changes to imports, dependencies, or packages',
    [RepairType.CONFIGURATION_CHANGE]: 'Modifications to configuration or settings',
    
    [RepairType.TEST_ADDITION]: 'Addition of new test cases',
    [RepairType.TEST_ADAPTATION]: 'Adaptation of existing tests to code changes',
    
    [RepairType.NO_OP_DEFERRED]: 'No changes made (deferred or intentionally avoided)',
    [RepairType.PARTIAL_REPAIR]: 'Incomplete or partial fix addressing only part of the issue',
    [RepairType.MULTI_STAGE_REPAIR]: 'Multi-stage repair requiring coordination across multiple commits'
};

/**
 * 全ての修正タイプの配列
 */
export const ALL_REPAIR_TYPES = Object.values(RepairType);

/**
 * 修正タイプの検証
 * @param {string} type - 検証する修正タイプ
 * @returns {boolean} 有効な修正タイプかどうか
 */
export function isValidRepairType(type) {
    return ALL_REPAIR_TYPES.includes(type);
}

/**
 * プロンプト用のテキスト生成
 * @returns {string} プロンプトに埋め込むテキスト
 */
export function generateRepairTypePromptText() {
    return ALL_REPAIR_TYPES.map(type => 
        `- ${type}: ${RepairTypeDescriptions[type]}`
    ).join('\n');
}

export default RepairType;
