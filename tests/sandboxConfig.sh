#!/bin/bash

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
REPO_DIR="$(cd -- "$SCRIPT_DIR" && cd .. && pwd)"
export PATH="$REPO_DIR/dist:$PATH"
exec bash
