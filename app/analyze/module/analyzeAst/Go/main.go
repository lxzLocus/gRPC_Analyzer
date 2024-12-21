package main

import (
	"log"
	"os"

	analyzeFunc "github.com/lxzLocus/gRPC_Analyzer/app/analyze/module/analyzeAst/Go/func"
	prog "github.com/lxzLocus/gRPC_Analyzer/app/analyze/module/analyzeAst/Go/prog"
)

func main() {
	if len(os.Args) < 3 {
		log.Fatalf("Usage: %s <command> <file.go>\nCommands:\n  imports: Analyze imports\n  functions: Analyze functions", os.Args[0])
	}

	command := os.Args[1]
	filePath := os.Args[2]

	switch command {
	case "imports":
		prog.RunAnalyzeGo(filePath)
	case "functions":
		analyzeFunc.RunAnalyzeFunctions(filePath)
	default:
		log.Fatalf("Unknown command: %s", command)
	}
}
