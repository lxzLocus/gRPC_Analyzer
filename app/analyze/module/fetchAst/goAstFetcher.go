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
)

func main() {
	src := `
		package main
		import "fmt"

		func main() {
			fmt.Println("Hello, world")
		}
	`

	// 1. ソースファイルをASTに変換
	fset := token.NewFileSet()
	node, err := parser.ParseFile(fset, "", src, parser.AllErrors)
	if err != nil {
		fmt.Println("Error parsing file:", err)
		return
	}

	// 2. ASTを解析してSelectorExprを見つける
	ast.Inspect(node, func(n ast.Node) bool {
		if sel, ok := n.(*ast.SelectorExpr); ok {
			if ident, ok := sel.X.(*ast.Ident); ok && ident.Name == "fmt" {
				fmt.Println("Package 'fmt' is used in the code")
			}
		}
		return true
	})
}
