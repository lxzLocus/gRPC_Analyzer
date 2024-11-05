/*
AST解析
import モジュールの利用を確認する
*/
package main

import (
	"bufio"
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"os"
)

func main() {
	// 標準入力からASTの文字列を読み取る
	scanner := bufio.NewScanner(os.Stdin)
	var src string
	for scanner.Scan() {
		src += scanner.Text() + "\n"
	}
	if err := scanner.Err(); err != nil {
		fmt.Println("Error reading from standard input:", err)
		return
	}

	// 1. ソースファイルをASTに変換
	fset := token.NewFileSet()
	node, err := parser.ParseFile(fset, "", src, parser.AllErrors)
	if err != nil {
		fmt.Println("Error parsing file:", err)
		return
	}

	// インポートされたパッケージを収集
	imports := make(map[string]bool)
	for _, imp := range node.Imports {
		importPath := imp.Path.Value
		importPath = importPath[1 : len(importPath)-1] // 文字列リテラルの引用符を削除
		imports[importPath] = false                    // 初期状態は未使用とする
	}

	// ASTを解析してSelectorExprを見つけ、使用されているインポートをチェック
	ast.Inspect(node, func(n ast.Node) bool {
		if sel, ok := n.(*ast.SelectorExpr); ok {
			if ident, ok := sel.X.(*ast.Ident); ok {
				if _, exists := imports[ident.Name]; exists {
					imports[ident.Name] = true // 使用されているとマーク
				}
			}
		}
		return true
	})

	// 使用状況の出力
	for importPath, used := range imports {
		if used {
			fmt.Printf("Package '%s' is used in the code\n", importPath)
		} else {
			fmt.Printf("Package '%s' is imported but not used in the code\n", importPath)
		}
	}
}
