/*
AST生成と解析
importしているモジュールを返す
Go
*/
package prog

import (
	"encoding/json"
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"io/ioutil"
	"log"
	"os"
	"path/filepath"
	"strings"
)

// RunAnalyzeGo は AST解析とインポートモジュール収集を実行します
func RunAnalyzeGo(filePath string) {
	// ファイルを読み込む
	sourceCode, err := ioutil.ReadFile(filePath)
	if err != nil {
		log.Fatalf("Error reading file: %v", err)
	}

	// ASTを生成
	fset, node := generateAST(filePath, sourceCode)

	// ASTを解析して、インポートされたモジュールを取得し、利用されているか確認
	importedModules := analyzeImportsAndUsage(fset, node)

	// 結果を出力
	fmt.Println("Imported Modules:", importedModules)

	// 実行ファイルのパスを取得
	execDir := filepath.Dir(os.Args[0])

	// ファイルに結果を出力
	outputFilePath := filepath.Join(execDir, "temp.json")
	file, err := os.Create(outputFilePath)
	if err != nil {
		log.Fatalf("Error creating output file: %v", err)
	}
	defer file.Close()

	// 結果をJSONファイルに書き込む
	jsonData, err := json.MarshalIndent(importedModules, "", "  ")
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
	// ソースコードをパースする
	fset := token.NewFileSet()
	node, err := parser.ParseFile(fset, filePath, sourceCode, parser.AllErrors)
	if err != nil {
		log.Fatalf("Error parsing file: %v", err)
	}

	return fset, node
}

func analyzeImportsAndUsage(fset *token.FileSet, node *ast.File) []string {
	imports := make(map[string]string)
	aliases := make(map[string]string)
	ast.Inspect(node, func(n ast.Node) bool {
		if imp, ok := n.(*ast.ImportSpec); ok {
			fullPath := strings.Trim(imp.Path.Value, `"`)
			packageName := ""
			if imp.Name != nil {
				packageName = imp.Name.Name
				aliases[packageName] = fullPath
			} else {
				segments := strings.Split(fullPath, "/")
				packageName = segments[len(segments)-1]
			}
			imports[packageName] = fullPath
		}
		return true
	})

	usedModules := make(map[string]bool)
	ast.Inspect(node, func(n ast.Node) bool {
		if sel, ok := n.(*ast.SelectorExpr); ok {
			if ident, ok := sel.X.(*ast.Ident); ok {
				if fullPath, exists := imports[ident.Name]; exists {
					usedModules[fullPath] = true
				} else if fullPath, exists := aliases[ident.Name]; exists {
					usedModules[fullPath] = true
				}
			}
		}
		return true
	})

	var result []string
	for module := range usedModules {
		result = append(result, module)
	}

	return result
}
