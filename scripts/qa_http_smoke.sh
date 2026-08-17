#!/usr/bin/env bash
set -u
URL="${1:-https://zaro-lmqgp2qmi-by06884-6458s-projects.vercel.app/}"
OUT="${2:-/tmp/zaro_http_metrics.tsv}"
: > "$OUT"
for i in $(seq 1 20); do
  curl -L -sS -o /dev/null -w "$i\t%{http_code}\t%{time_namelookup}\t%{time_connect}\t%{time_starttransfer}\t%{time_total}\t%{size_download}\n" "$URL" >> "$OUT" || echo "$i\tCURL_ERROR" >> "$OUT"
done
awk -F '\t' 'NR==1{min=$6;max=$6;sum=0} {if($2==200){sum+=$6;if($6<min)min=$6;if($6>max)max=$6;ok++}} END{printf "ok=%d total=%d min=%.3fs avg=%.3fs max=%.3fs\n",ok,NR,min,(ok?sum/ok:0),max}' "$OUT"
cat "$OUT"
