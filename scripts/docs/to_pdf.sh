#!/bin/bash
# Converts a .docx or .pptx to PDF with the Office apps installed on this Mac,
# falling back to Pages/Keynote. Usage: to_pdf.sh <file>
set -u
IN="$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"
OUT="${IN%.*}.pdf"; rm -f "$OUT"
case "$IN" in
  *.docx)
    osascript <<AS >/dev/null 2>&1
with timeout of 600 seconds
  tell application "Microsoft Word"
    activate
    open (POSIX file "$IN")
    delay 3
    set d to active document
    save as d file name "$OUT" file format format PDF
    close d saving no
  end tell
end timeout
AS
    if [ ! -s "$OUT" ]; then
      osascript <<AS >/dev/null 2>&1
with timeout of 600 seconds
  tell application "Pages"
    set d to open (POSIX file "$IN")
    export d to (POSIX file "$OUT") as PDF
    close d saving no
  end tell
end timeout
AS
    fi ;;
  *.pptx)
    osascript <<AS >/dev/null 2>&1
with timeout of 600 seconds
  tell application "Microsoft PowerPoint"
    activate
    open (POSIX file "$IN")
    delay 3
    set p to active presentation
    save p in (POSIX file "$OUT") as save as PDF
    close p saving no
  end tell
end timeout
AS
    if [ ! -s "$OUT" ]; then
      osascript <<AS >/dev/null 2>&1
with timeout of 600 seconds
  tell application "Keynote"
    set d to open (POSIX file "$IN")
    export d to (POSIX file "$OUT") as PDF
    close d saving no
  end tell
end timeout
AS
    fi ;;
esac
[ -s "$OUT" ] && echo "$OUT" || { echo "conversion failed for $IN" >&2; exit 1; }
