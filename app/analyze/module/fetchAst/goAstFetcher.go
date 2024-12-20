/*
AST解析
import モジュールの利用を確認する
*/
package main

import (
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"os"
	"strings"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Println("Please provide the source code as an argument.")
		return
	}

	src := os.Args[1]

	// ソースファイルをASTに変換
	fset := token.NewFileSet()
	node, err := parser.ParseFile(fset, "", src, parser.AllErrors)
	if err != nil {
		fmt.Println("Error parsing file:", err)
		return
	}

	// インポートされたパッケージを収集
	imports := make(map[string]bool)
	ast.Inspect(node, func(n ast.Node) bool {
		if imp, ok := n.(*ast.ImportSpec); ok {
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
