/*
AST生成と解析
関数を返す
Go
*/
package analyzeFunc

import (
	"encoding/json"
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"log"
	"os"
	"path/filepath"
)

// RunAnalyzeFunctions は AST解析を実行して関数一覧を出力します
func RunAnalyzeFunctions(filePath string) {
	// ファイルを読み込む
	sourceCode, err := os.ReadFile(filePath)
	if err != nil {
		log.Fatalf("Error reading file: %v", err)
	}

	// ASTを生成
	fset, node := generateAST(filePath, sourceCode)

	// ASTを解析して、定義されている関数一覧を取得
	functions := analyzeFunctions(fset, node)

	// 各関数内で使用されているメソッドを抽出
	functionCalls := analyzeFunctionCalls(fset, node)

	// 出力データを構造化
	outputData := map[string]interface{}{
		"functions":     functions,
		"functionCalls": functionCalls,
	}

	// 実行ファイルのパスを取得
	execDir := filepath.Dir(os.Args[0])

	fmt.Printf("Current directory: %s\n", execDir)

	outputFilePath := filepath.Join(execDir, "temp.json")
	fmt.Printf("Output file path: %s\n", outputFilePath)
	file, err := os.Create(outputFilePath)

	if err != nil {
		log.Fatalf("Error creating output file: %v", err)
	}
	defer file.Close()

	// 結果をJSONファイルに書き込む
	jsonData, err := json.MarshalIndent(outputData, "", "  ")
	if err != nil {
		log.Fatalf("Error marshaling to JSON: %v", err)
	}

	_, err = file.Write(jsonData)
	if err != nil {
		log.Fatalf("Error writing to file: %v", err)
	}

	fmt.Printf("Results written to %s\n", outputFilePath)
}

// 以下は元の関数をそのまま移植
func generateAST(filePath string, sourceCode []byte) (*token.FileSet, *ast.File) {
	fset := token.NewFileSet()
	node, err := parser.ParseFile(fset, filePath, sourceCode, parser.AllErrors)
	if err != nil {
		log.Fatalf("Error parsing file: %v", err)
	}

	return fset, node
}

func analyzeFunctions(fset *token.FileSet, node *ast.File) []string {
	var functions []string
	ast.Inspect(node, func(n ast.Node) bool {
		if fn, ok := n.(*ast.FuncDecl); ok {
			// メソッドの場合、Recvがnilでなければ構造体のメソッド
			if fn.Recv != nil {
				// メソッドの場合
				functions = append(functions, fmt.Sprintf("%s", fn.Name.Name))
			} else {
				// 通常の関数
				functions = append(functions, fn.Name.Name)
			}
		}
		return true
	})

	return functions
}

// 関数内で使用されている関数やメソッド呼び出しを抽出
func analyzeFunctionCalls(fset *token.FileSet, node *ast.File) map[string][]string {
	functionCalls := make(map[string][]string)

	ast.Inspect(node, func(n ast.Node) bool {
		if fn, ok := n.(*ast.FuncDecl); ok {
			var calls []string
			ast.Inspect(fn.Body, func(n ast.Node) bool {
				// 関数呼び出しを探す
				if call, ok := n.(*ast.CallExpr); ok {
					// 呼び出しの対象を特定
					switch fun := call.Fun.(type) {
					case *ast.SelectorExpr:
						// メソッド呼び出しの場合
						calls = append(calls, fmt.Sprintf("%s.%s", formatExpr(fun.X), fun.Sel.Name))
					case *ast.Ident:
						// 単純な関数呼び出し
						calls = append(calls, fun.Name)
					}
				}
				return true
			})
			functionCalls[fn.Name.Name] = calls
		}
		return true
	})

	return functionCalls
}

// 式を文字列としてフォーマット
func formatExpr(expr ast.Expr) string {
	switch x := expr.(type) {
	case *ast.Ident:
		return x.Name
	case *ast.SelectorExpr:
		return fmt.Sprintf("%s.%s", formatExpr(x.X), x.Sel.Name)
	default:
		return "<unknown>"
	}
}
