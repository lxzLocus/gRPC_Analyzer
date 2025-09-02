/**
 * executeLLMEvaluation テンプレート変数の実使用例
 */

// DatasetAnalysisController.executeLLMEvaluation() で生成される
// evaluationContext の構造例

export const SAMPLE_EVALUATION_CONTEXT = {
    // ==============================================
    // 🎯 主要なDiff情報
    // ==============================================
    
    ground_truth_diff: `diff --git a/src/main/proto/user.proto b/src/main/proto/user.proto
index 1234567..abcdefg 100644
--- a/src/main/proto/user.proto
+++ b/src/main/proto/user.proto
@@ -10,6 +10,7 @@ message User {
   string name = 1;
   string email = 2;
+  int32 age = 3;
 }

diff --git a/src/main/proto/service.proto b/src/main/proto/service.proto
index 9876543..1a2b3c4 100644
--- a/src/main/proto/service.proto
+++ b/src/main/proto/service.proto
@@ -5,4 +5,5 @@ service UserService {
   rpc GetUser(GetUserRequest) returns (User);
   rpc CreateUser(CreateUserRequest) returns (User);
+  rpc UpdateUser(UpdateUserRequest) returns (User);
 }`,

    agent_generated_diff: `diff --git a/src/main/proto/user.proto b/src/main/proto/user.proto
--- a/src/main/proto/user.proto
+++ b/src/main/proto/user.proto
@@ -10,6 +10,7 @@ message User {
   string name = 1;
   string email = 2;
+  int32 age = 3;
 }`,

    // ==============================================
    // 🤖 エージェントの思考プロセス
    // ==============================================
    
    agent_thought_process: `Turn 1: ユーザープロファイルにage フィールドを追加する必要があることを分析しました。

Turn 2: user.proto ファイルを確認し、既存のフィールド構造を理解しました。

Turn 3: age フィールドを int32 型として追加することに決定しました。

Turn 4: 変更を適用し、コンパイルエラーがないことを確認しました。`,

    // ==============================================
    // 📁 ファイル・パス情報
    // ==============================================
    
    premergePath: "/app/dataset/example-project/confirmed/PR-123/premerge",
    mergePath: "/app/dataset/example-project/confirmed/PR-123/commit_snapshot_abc123",
    
    aprDiffFiles: [
        "src/main/proto/user.proto",
        "src/main/proto/service.proto"
    ],
    
    affectedFileCount: 2,

    // ==============================================
    // 🧠 コードコンテキスト
    // ==============================================
    
    codeContext: {
        premergeFiles: {
            "src/main/proto/user.proto": {
                content: `syntax = "proto3";

package user;

message User {
  string name = 1;
  string email = 2;
}`,
                lineCount: 8,
                size: 95
            },
            "src/main/proto/service.proto": {
                content: `syntax = "proto3";

import "user.proto";

service UserService {
  rpc GetUser(GetUserRequest) returns (User);
  rpc CreateUser(CreateUserRequest) returns (User);
}`,
                lineCount: 8,
                size: 142
            }
        },
        
        mergeFiles: {
            "src/main/proto/user.proto": {
                content: `syntax = "proto3";

package user;

message User {
  string name = 1;
  string email = 2;
  int32 age = 3;
}`,
                lineCount: 9,
                size: 110
            },
            "src/main/proto/service.proto": {
                content: `syntax = "proto3";

import "user.proto";

service UserService {
  rpc GetUser(GetUserRequest) returns (User);
  rpc CreateUser(CreateUserRequest) returns (User);
  rpc UpdateUser(UpdateUserRequest) returns (User);
}`,
                lineCount: 9,
                size: 185
            }
        },
        
        fileSummary: {
            totalFiles: 2,
            fileTypes: {
                ".proto": 2
            },
            totalLines: 18
        }
    },

    // ==============================================
    // 📊 メタデータ・統計情報
    // ==============================================
    
    totalTurns: 4,
    modificationCount: 1,
    groundTruthLineCount: 14,
    agentDiffLineCount: 7
};

/**
 * テンプレート使用方法の説明
 */
console.log(`
🎯 テンプレート変数の使用方法:

1. 基本的な変数アクセス:
   {{ground_truth_diff}}
   {{agent_generated_diff}}
   {{agent_thought_process}}

2. 配列・オブジェクトのアクセス:
   {{#each aprDiffFiles}}
     - {{this}}
   {{/each}}

3. 条件分岐:
   {{#if ground_truth_diff}}
     Ground Truthが利用可能
   {{/if}}

4. 数値比較:
   {{#if (gt affectedFileCount 5)}}
     多数のファイルが変更されています
   {{/if}}

5. ネストしたオブジェクトアクセス:
   {{codeContext.fileSummary.totalFiles}}
   {{#each codeContext.fileSummary.fileTypes}}
     {{@key}}: {{this}}個
   {{/each}}

6. 動的プロパティアクセス:
   {{#each aprDiffFiles}}
     {{#with (lookup ../codeContext.premergeFiles this)}}
       {{content}}
     {{/with}}
   {{/each}}
`);

export { SAMPLE_EVALUATION_CONTEXT };
