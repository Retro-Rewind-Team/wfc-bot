rm -rf build

echo "Building"

tsc || exit "$?"

echo "Transforming imports"

find ./build -iname "*.js" -print0 | xargs -0 -I {} sed -i "s/#src/#b/g" {}

echo "Finished"
