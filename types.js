/**
 * 型定義ファイル
 * プロジェクト全体で使用する共通の型定義
 */
export var State;
(function (State) {
    State["Start"] = "Start";
    State["PrepareInitialContext"] = "PrepareInitialContext";
    State["SendInitialInfoToLLM"] = "SendInitialInfoToLLM";
    State["LLMAnalyzePlan"] = "LLMAnalyzePlan";
    State["LLMDecision"] = "LLMDecision";
    State["SystemAnalyzeRequest"] = "SystemAnalyzeRequest";
    State["GetFileContent"] = "GetFileContent";
    State["GetDirectoryListing"] = "GetDirectoryListing";
    State["ProcessRequiredInfos"] = "ProcessRequiredInfos";
    State["SendInfoToLLM"] = "SendInfoToLLM";
    State["LLMReanalyze"] = "LLMReanalyze";
    State["SystemParseDiff"] = "SystemParseDiff";
    State["SystemApplyDiff"] = "SystemApplyDiff";
    State["CheckApplyResult"] = "CheckApplyResult";
    State["SendResultToLLM"] = "SendResultToLLM";
    State["LLMNextStep"] = "LLMNextStep";
    State["SendErrorToLLM"] = "SendErrorToLLM";
    State["LLMErrorReanalyze"] = "LLMErrorReanalyze";
    State["End"] = "End";
})(State || (State = {}));
