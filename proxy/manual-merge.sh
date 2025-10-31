#!/bin/bash

# Manual Merge Script for Windows-style path directories
# Handles the malformed directory names with proper copying

set -e

PROXY_DIR="/mnt/c/github/claudeplus/proxy"
TARGET_DIR="$PROXY_DIR/spaceship-simulator"
LOG_FILE="$PROXY_DIR/manual-merge.log"

echo "=== Manual Merge Script Started at $(date) ===" | tee -a "$LOG_FILE"

# Function to log with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Function to safely copy files from malformed directories
manual_merge() {
    cd "$PROXY_DIR"
    
    # List of source directories with malformed names
    declare -a source_dirs=(
        "C:\\github\\claudeplus\\proxy\\spaceship-simulator"
        "C:\\github\\claudeplus\\proxy\\spaceship-simulator "
    )
    
    for source_dir in "${source_dirs[@]}"; do
        if [[ -d "$source_dir" ]]; then
            log "Processing source directory: $source_dir"
            
            # Find all files in source directory
            find "$source_dir" -type f | while read -r file; do
                # Get relative path from source directory
                rel_path="${file#$source_dir/}"
                target_file="$TARGET_DIR/$rel_path"
                
                # Create target directory if needed
                target_dir="$(dirname "$target_file")"
                mkdir -p "$target_dir"
                
                # Check if target file exists
                if [[ -f "$target_file" ]]; then
                    # Compare files
                    if ! cmp -s "$file" "$target_file"; then
                        log "Conflict detected: $rel_path"
                        # Backup existing file and copy newer one
                        cp "$target_file" "${target_file}.backup"
                        cp "$file" "$target_file"
                        log "Replaced: $rel_path (backup created)"
                    else
                        log "Identical file: $rel_path (skipped)"
                    fi
                else
                    # Copy new file
                    cp "$file" "$target_file"
                    log "Copied new file: $rel_path"
                fi
            done
            
            log "Completed processing: $source_dir"
        fi
    done
}

# Function to verify the merge
verify_manual_merge() {
    log "Verifying manual merge results..."
    
    cd "$PROXY_DIR"
    
    # Count total files
    total_files=$(find "$TARGET_DIR" -type f | wc -l)
    log "Total files in target directory: $total_files"
    
    # Check for any remaining malformed directories
    remaining_dirs=$(find . -maxdepth 1 -type d -name "*C:*" | wc -l)
    log "Remaining malformed directories: $remaining_dirs"
    
    # Generate directory structure
    log "Current directory structure:"
    find "$TARGET_DIR" -type d | sort >> "$LOG_FILE"
}

# Main execution
main() {
    log "Starting manual merge operation"
    
    manual_merge
    verify_manual_merge
    
    log "Manual merge operation completed"
    log "Log file: $LOG_FILE"
    
    echo ""
    echo "=== MANUAL MERGE SUMMARY ==="
    echo "Target directory: $TARGET_DIR"
    echo "Log file: $LOG_FILE"
    echo ""
}

# Run main function
main

echo "=== Manual Merge Script Completed at $(date) ==="