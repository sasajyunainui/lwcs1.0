#!/usr/bin/env bash
cd "D:/silltyavern/tavern_helper_template-main/tavern_helper_template-main/lwcs" || exit 1
set -e
talent_for() {
  case "$1" in
    th*) echo "绝世妖孽";;
    bb*) echo "绝世妖孽";;
    zw*) echo "优秀";;
    ds*) echo "正常";;
  esac
}
for f in "$@"; do
  name="${f##*/}"; name="${name%.json}"
  t=$(talent_for "$name")
  json=$(cat "$f")
  path=$(node -e "const o=JSON.parse(process.argv[1]);process.stdout.write(o.path)" "$json")
  after=$(node -e "const o=JSON.parse(process.argv[1]);process.stdout.write(JSON.stringify(o.after))" "$json")
  echo "### $name"
  node tmp/_probe_tune.mjs --profile dldl --talent "$t" --path "$path" "$after"
done
