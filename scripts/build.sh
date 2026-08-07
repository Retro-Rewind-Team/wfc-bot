rm -rf build

echo "Building"

tsc || exit "$?"

echo "Transforming imports"

find ./build -iname "*.js" -print0 | xargs -0 -I {} sed -i "s/#src/#b/g" {}

branch=$(git rev-parse --abbrev-ref HEAD)
commit=$(git describe --always --dirty)
build_id="$branch-$commit"

echo "Setting build identifier to $build_id"

echo "export const commit = \"$build_id\";" >./build/src/commands/shared/commit.js

echo "Finished"
