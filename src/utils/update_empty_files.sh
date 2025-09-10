#!/bin/sh

MESSAGE="No handwritten files found. Only auto-generated files were modified.

In this pull request, only .proto files and their auto-generated files (.pb.go, etc.) 
were modified. No handwritten code files were changed.
Therefore, no suspected handwritten files exist for analysis.

File categorization of changes:
- Proto files: .proto files
- Generated files: Files matching patterns like .pb.go, .pb.cc, .pb.h, etc.
- Handwritten files: None (excluding excluded files, test files, and auto-generated files)"

echo "Finding empty 05_suspectedFiles.txt files..."

# Find all empty files and count them
EMPTY_FILES=$(find /app/dataset/filtered_commit -name "05_suspectedFiles.txt" -size 0)
COUNT=$(echo "$EMPTY_FILES" | wc -l)

if [ -z "$EMPTY_FILES" ]; then
    echo "No empty files found."
    exit 0
fi

echo "Found $COUNT empty files"

# Update each empty file
UPDATED=0
echo "$EMPTY_FILES" | while read -r file; do
    if [ -n "$file" ]; then
        echo "$MESSAGE" > "$file"
        UPDATED=$((UPDATED + 1))
        if [ $UPDATED -le 5 ]; then
            echo "✓ Updated: $file"
        fi
    fi
done

echo "Update completed for all empty files"
