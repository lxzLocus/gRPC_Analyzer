/*
AST生成と解析
importしているモジュールを返す
Go
*/
package main

import (
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

func main() {
	if len(os.Args) < 2 {
		log.Fatalf("Usage: %s <file.go>", os.Args[0])
	}

	filePath := os.Args[1]

	// ファイルを読み込む
	sourceCode, err := ioutil.ReadFile(filePath)
	if err != nil {
		log.Fatalf("Error reading file: %v", err)
	}

	// ASTを生成
	fset, node := generateAST(filePath, sourceCode)

	// ASTを解析して、インポートされたモジュールを取得し、利用されているか確認
	importedModules := analyzeImportsAndUsage(fset, node)

	// 実行ファイルのパスを取得
	execPath, err := os.Executable()
	if err != nil {
		log.Fatalf("Error getting executable path: %v", err)
	}
	execDir := filepath.Dir(execPath)

	// ファイルに結果を出力
	outputFilePath := filepath.Join(execDir, "temp")
	file, err := os.Create(outputFilePath)
	if err != nil {
		log.Fatalf("Error creating output file: %v", err)
	}
	defer file.Close()

	// 結果をファイルに書き込む
	_, err = file.WriteString(fmt.Sprintf("%v\n", importedModules))
	if err != nil {
		log.Fatalf("Error writing to file: %v", err)
	}

	fmt.Printf("Results written to %s\n", outputFilePath)
}

// ASTを生成する関数
func generateAST(filePath string, sourceCode []byte) (*token.FileSet, *ast.File) {
	// ソースコードをパースする
	fset := token.NewFileSet()
	node, err := parser.ParseFile(fset, filePath, sourceCode, parser.AllErrors)
	if err != nil {
		log.Fatalf("Error parsing file: %v", err)
	}

	// ASTを出力する
	//ast.Print(fset, node)
	return fset, node
}

// ASTを解析してインポートされたモジュールを取得し、利用されているか確認する関数
func analyzeImportsAndUsage(fset *token.FileSet, node *ast.File) []string {
	// インポートされたパッケージを収集
	imports := make(map[string]bool)
	ast.Inspect(node, func(n ast.Node) bool {
		// ImportSpecノードを見つけてimportされたパッケージを記録
		if imp, ok := n.(*ast.ImportSpec); ok {
			// パッケージ名を取り出すためにパスをスラッシュで分割し，最後の要素を使用
			fullPath := strings.Trim(imp.Path.Value, `"`)
			segments := strings.Split(fullPath, "/")
			packageName := segments[len(segments)-1]
			imports[packageName] = false
		}
		return true
	})

	// ASTを解析してSelectorExprを見つけ、使用されているインポートをチェック
	ast.Inspect(node, func(n ast.Node) bool {
		if sel, ok := n.(*ast.SelectorExpr); ok {
			if ident, ok := sel.X.(*ast.Ident); ok {
				// ident.Nameはパッケージ名を表しているので、マップに存在すれば利用フラグをtrueにする
				if _, exists := imports[ident.Name]; exists {
					imports[ident.Name] = true
				}
			}
		}
		return true
	})

	// 使用されているインポートされたモジュールをリストアップ
	var usedModules []string
	for module, used := range imports {
		if used {
			usedModules = append(usedModules, module)
		}
	}

	return usedModules
}
