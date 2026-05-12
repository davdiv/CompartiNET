#!/bin/bash

set -e

if [ "$1" == "-ti" ]; then
INTERACTIVE="-ti"
shift
else
INTERACTIVE=
fi
IMAGE="compartinet-test"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
REPO_DIR="$(cd -- "$SCRIPT_DIR" && cd .. && pwd)"
docker build --tag "$IMAGE" "$SCRIPT_DIR/container"

exec docker run $INTERACTIVE --rm \
	--network none \
	--cap-add=NET_ADMIN \
	--cap-add=SYS_ADMIN \
	-v "$REPO_DIR:/app" \
	-w /app \
	"$IMAGE" \
	"$@"
