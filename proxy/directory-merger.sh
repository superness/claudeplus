#!/bin/bash

# Directory Merger Script for Spaceship Simulator Duplication Issue
# This script safely merges duplicated directories and resolves conflicts

set -e  # Exit on any error

PROXY_DIR="/mnt/c/github/claudeplus/proxy"
BACKUP_DIR="$PROXY_DIR/backup-$(date +%Y%m%d-%H%M%S)"
TARGET_DIR="$PROXY_DIR/spaceship-simulator"
LOG_FILE="$PROXY_DIR/merge-operation.log"

echo "=== Directory Merger Script Started at $(date) ===" | tee -a "$LOG_FILE"

# Function to log with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Function to create backup
create_backup() {
    log "Creating comprehensive backup..."
    mkdir -p "$BACKUP_DIR"
    
    # Backup all spaceship-simulator related directories
    cd "$PROXY_DIR"
    
    if [[ -d "spaceship-simulator" ]]; then
        log "Backing up spaceship-simulator directory..."
        cp -r "spaceship-simulator" "$BACKUP_DIR/spaceship-simulator-original"
    fi
    
    if [[ -d "C:\\github\\claudeplus\\proxy\\spaceship-simulator" ]]; then
        log "Backing up malformed path directory 1..."
        cp -r "C:\\github\\claudeplus\\proxy\\spaceship-simulator" "$BACKUP_DIR/malformed-path-1"
    fi
    
    if [[ -d "C:\\github\\claudeplus\\proxy\\spaceship-simulator " ]]; then
        log "Backing up malformed path directory 2 (with trailing space)..."
        cp -r "C:\\github\\claudeplus\\proxy\\spaceship-simulator " "$BACKUP_DIR/malformed-path-2"
    fi
    
    log "Backup completed to: $BACKUP_DIR"
}

# Function to analyze directory contents
analyze_directories() {
    log "Analyzing directory contents..."
    
    cd "$PROXY_DIR"
    
    echo "=== DIRECTORY ANALYSIS ===" >> "$LOG_FILE"
    
    for dir in "spaceship-simulator" "C:\\github\\claudeplus\\proxy\\spaceship-simulator" "C:\\github\\claudeplus\\proxy\\spaceship-simulator "; do
        if [[ -d "$dir" ]]; then
            echo "--- Contents of: $dir ---" >> "$LOG_FILE"
            find "$dir" -type f -exec ls -la {} \; >> "$LOG_FILE" 2>/dev/null || true
            echo "--- File count: $(find "$dir" -type f | wc -l) ---" >> "$LOG_FILE"
            echo "" >> "$LOG_FILE"
        fi
    done
}

# Function to preview merge operations
preview_merge() {
    log "Previewing merge operations with rsync dry-run..."
    
    cd "$PROXY_DIR"
    
    # Create target directory if it doesn't exist
    mkdir -p "$TARGET_DIR"
    
    echo "=== MERGE PREVIEW ===" >> "$LOG_FILE"
    
    # Preview merging from malformed directories
    for source_dir in "C:\\github\\claudeplus\\proxy\\spaceship-simulator" "C:\\github\\claudeplus\\proxy\\spaceship-simulator "; do
        if [[ -d "$source_dir" ]]; then
            log "Previewing merge from: $source_dir"
            echo "--- Merge preview from: $source_dir ---" >> "$LOG_FILE"
            rsync --dry-run -av --itemize-changes "$source_dir/" "$TARGET_DIR/" >> "$LOG_FILE" 2>&1 || true
            echo "" >> "$LOG_FILE"
        fi
    done
}

# Function to execute merge
execute_merge() {
    log "Executing directory merge..."
    
    cd "$PROXY_DIR"
    
    # Ensure target directory exists
    mkdir -p "$TARGET_DIR"
    
    echo "=== MERGE EXECUTION ===" >> "$LOG_FILE"
    
    # Merge from malformed directories
    for source_dir in "C:\\github\\claudeplus\\proxy\\spaceship-simulator" "C:\\github\\claudeplus\\proxy\\spaceship-simulator "; do
        if [[ -d "$source_dir" ]]; then
            log "Merging from: $source_dir"
            echo "--- Merging from: $source_dir ---" >> "$LOG_FILE"
            
            # Use rsync with backup for conflict resolution
            rsync -av --backup --backup-dir="$BACKUP_DIR/conflicts-$(basename "$source_dir")" \
                  --itemize-changes "$source_dir/" "$TARGET_DIR/" >> "$LOG_FILE" 2>&1 || true
            
            echo "Merge completed from: $source_dir" >> "$LOG_FILE"
        fi
    done
}

# Function to verify merge
verify_merge() {
    log "Verifying merge results..."
    
    cd "$PROXY_DIR"
    
    echo "=== MERGE VERIFICATION ===" >> "$LOG_FILE"
    
    # Count files in target directory
    target_count=$(find "$TARGET_DIR" -type f | wc -l)
    log "Files in target directory: $target_count"
    
    # Generate checksums for verification
    if [[ $target_count -gt 0 ]]; then
        log "Generating checksums for verification..."
        find "$TARGET_DIR" -type f -exec md5sum {} \; > "$BACKUP_DIR/target-checksums.md5" 2>/dev/null || true
        log "Checksums saved to: $BACKUP_DIR/target-checksums.md5"
    fi
    
    # Check git status if it's a git repository
    if [[ -d "$TARGET_DIR/.git" ]]; then
        log "Checking git repository status..."
        cd "$TARGET_DIR"
        echo "--- Git Status ---" >> "$LOG_FILE"
        git status >> "$LOG_FILE" 2>&1 || true
        echo "--- Recent Git Log ---" >> "$LOG_FILE"
        git log --oneline -5 >> "$LOG_FILE" 2>&1 || true
        cd "$PROXY_DIR"
    fi
}

# Function to clean up source directories
cleanup_sources() {
    log "Cleaning up source directories..."
    
    cd "$PROXY_DIR"
    
    # Remove malformed directories after successful merge
    for source_dir in "C:\\github\\claudeplus\\proxy\\spaceship-simulator" "C:\\github\\claudeplus\\proxy\\spaceship-simulator "; do
        if [[ -d "$source_dir" ]]; then
            log "Removing source directory: $source_dir"
            rm -rf "$source_dir" || log "Failed to remove: $source_dir"
        fi
    done
    
    log "Cleanup completed"
}

# Main execution
main() {
    log "Starting directory merge operation"
    
    create_backup
    analyze_directories
    preview_merge
    execute_merge
    verify_merge
    
    log "Merge operation completed successfully"
    log "Backup location: $BACKUP_DIR"
    log "Log file: $LOG_FILE"
    
    echo ""
    echo "=== MERGE SUMMARY ==="
    echo "Target directory: $TARGET_DIR"
    echo "Backup location: $BACKUP_DIR"
    echo "Log file: $LOG_FILE"
    echo ""
    echo "To complete cleanup, run: $0 cleanup"
}

# Handle cleanup command
if [[ "$1" == "cleanup" ]]; then
    cleanup_sources
    log "Cleanup operation completed"
    exit 0
fi

# Run main function
main

echo "=== Directory Merger Script Completed at $(date) ==="