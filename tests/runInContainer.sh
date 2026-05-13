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

# note: when changing parameters here, also update .devcontainer/container/sudo-docker
exec docker run \
	-v "$REPO_DIR:/workspace" \
	--rm \
	--network none \
	--security-opt apparmor=unconfined \
	--cap-add=NET_ADMIN \
	--cap-add=SYS_ADMIN \
	-w /workspace \
	$INTERACTIVE \
	"$IMAGE" \
	"$@"
