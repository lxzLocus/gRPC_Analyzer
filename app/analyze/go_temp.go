/*
AST生成と解析
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

	// ASTを解析
	analyzeAST(fset, node)
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
	ast.Print(fset, node)
	return fset, node
}

// ASTを解析する関数
func analyzeAST(fset *token.FileSet, node *ast.File) {
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

	// 利用状況を出力
	for pkg, used := range imports {
		if used {
			fmt.Printf("Package '%s' is used in the code.\n", pkg)
		} else {
			fmt.Printf("Package '%s' is imported but not used.\n", pkg)
		}
	}
}
