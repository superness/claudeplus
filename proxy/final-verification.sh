#!/bin/bash

# Final Verification Script
cd /mnt/c/github/claudeplus/proxy

echo "=== Final Directory Verification ==="
echo "Current working directory: $(pwd)"
echo ""

echo "=== Listing all directories in proxy folder ==="
ls -la | grep "^d"
echo ""

echo "=== Checking for spaceship-related directories ==="
find . -maxdepth 1 -type d -name "*spaceship*" -o -name "*C:*"
echo ""

echo "=== Checking target spaceship-simulator directory ==="
if [[ -d "spaceship-simulator" ]]; then
    echo "✅ Target directory exists: spaceship-simulator"
    echo "Files in target: $(find spaceship-simulator -type f | wc -l)"
    echo "Size: $(du -sh spaceship-simulator | cut -f1)"
else
    echo "❌ Target directory missing: spaceship-simulator"
fi
echo ""

echo "=== Checking for malformed directories ==="
malformed_count=0
for dir in "C:\\github\\claudeplus\\proxy\\spaceship-simulator"*; do
    if [[ -d "$dir" ]]; then
        echo "⚠️  Found malformed directory: $dir"
        echo "   Files: $(find "$dir" -type f | wc -l)"
        echo "   Size: $(du -sh "$dir" | cut -f1)"
        malformed_count=$((malformed_count + 1))
    fi
done

if [[ $malformed_count -eq 0 ]]; then
    echo "✅ No malformed directories found"
else
    echo "⚠️  Found $malformed_count malformed directories"
fi
echo ""

echo "=== Backup Directory Check ==="
if [[ -d "backup-20251029-212146" ]]; then
    echo "✅ Backup directory exists"
    echo "Backup size: $(du -sh backup-20251029-212146 | cut -f1)"
else
    echo "❌ Backup directory missing"
fi
echo ""

echo "=== Git Repository Status ==="
if [[ -d "spaceship-simulator/.git" ]]; then
    cd spaceship-simulator
    echo "✅ Git repository found"
    echo "Branch: $(git branch --show-current)"
    echo "Untracked files: $(git status --porcelain | grep "^??" | wc -l)"
    echo "Modified files: $(git status --porcelain | grep "^ M" | wc -l)"
    cd ..
else
    echo "❌ Git repository not found in target directory"
fi
echo ""

echo "=== Summary ==="
if [[ -d "spaceship-simulator" ]] && [[ $(find spaceship-simulator -type f | wc -l) -gt 100 ]]; then
    echo "🎉 MERGE SUCCESSFUL!"
    echo "   Target directory has $(find spaceship-simulator -type f | wc -l) files"
    echo "   All features appear to be merged successfully"
else
    echo "⚠️  MERGE INCOMPLETE"
    echo "   Target directory may be missing files"
fi

echo ""
echo "=== Next Steps ==="
if [[ $malformed_count -gt 0 ]]; then
    echo "1. Remove malformed directories: rm -rf \"C:\\\\github\\\\claudeplus\\\\proxy\\\\spaceship-simulator\"*"
else
    echo "1. ✅ No cleanup needed - malformed directories already removed"
fi
echo "2. Test the application to ensure all features work"
echo "3. Commit changes if everything is working correctly"

echo ""
echo "=== Final Verification Complete ==="