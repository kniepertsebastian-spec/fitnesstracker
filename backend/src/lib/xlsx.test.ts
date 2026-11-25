import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { columnIndex, decodeXml, readXlsxRows, readZip } from "./xlsx.js";

// Builds a zip in memory (deflate, one stored entry) the way Excel writes it: local headers,
// central directory, end record. CRCs are left at 0: the reader does not check them.
function zip(entries: Record<string, string>, store: string[] = []): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(entries)) {
    const raw = Buffer.from(content, "utf8");
    const stored = store.includes(name);
    const data = stored ? raw : deflateRawSync(raw);
    const nameBuf = Buffer.from(name, "utf8");
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(stored ? 0 : 8, 8);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(stored ? 0 : 8, 10);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBuf, data);
    centrals.push(central, nameBuf);
    offset += local.length + nameBuf.length + data.length;
  }
  const dir = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(entries).length, 8);
  end.writeUInt16LE(Object.keys(entries).length, 10);
  end.writeUInt32LE(dir.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, dir, end]);
}

const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';

const workbook = {
  "xl/workbook.xml": `<?xml version="1.0"?><workbook ${NS}><sheets><sheet name="Daten" sheetId="1" r:id="rId3"/></sheets></workbook>`,
  "xl/_rels/workbook.xml.rels": `<?xml version="1.0"?><Relationships><Relationship Id="rId1" Target="styles.xml"/><Relationship Id="rId3" Type="ws" Target="worksheets/daten.xml"/></Relationships>`,
  "xl/sharedStrings.xml": `<?xml version="1.0"?><sst ${NS}><si><t>BLS Code</t></si><si><t xml:space="preserve">Äpfel &amp; Birnen </t></si><si><r><t>Fett</t></r><r><rPr><b/></rPr><t> [g/100g]</t></r></si><si><t>&lt;LOD</t></si><si/></sst>`,
  "xl/worksheets/daten.xml": `<?xml version="1.0"?><worksheet ${NS}><sheetData>
    <row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="s"><v>2</v></c></row>
    <row r="2" spans="1:4"><c r="A2" t="s"><v>1</v></c><c r="B2" s="3"/><c r="C2"><v>9.3000000000000007</v></c><c r="D2" t="s"><v>3</v></c></row>
    <row r="3"/>
    <row r="4"><c r="A4" t="inlineStr"><is><t>inline</t></is></c><c r="B4" t="b"><v>1</v></c><c r="AA4" t="str"><v>x&gt;1</v></c><c r="AB4" t="s"><v>4</v></c></row>
  </sheetData></worksheet>`,
};

describe("xlsx reader", () => {
  it("reads deflated and stored zip entries", () => {
    const files = readZip(zip({ "a.txt": "hallo", "b.txt": "welt" }, ["b.txt"]));
    expect(files.get("a.txt")!.toString()).toBe("hallo");
    expect(files.get("b.txt")!.toString()).toBe("welt");
  });

  it("reads the first sheet via the workbook relations, with every cell type", () => {
    const rows = readXlsxRows(zip(workbook));
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual(["BLS Code", null, "Fett [g/100g]"]);
    expect(rows[1]).toEqual(["Äpfel & Birnen ", null, 9.3, "<LOD"]);
    expect(rows[2]![0]).toBe("inline");
    expect(rows[2]![1]).toBe(true);
    expect(rows[2]![26]).toBe("x>1");
    expect(rows[2]![27]).toBe("");
  });

  it("helpers", () => {
    expect(columnIndex("A")).toBe(0);
    expect(columnIndex("Z")).toBe(25);
    expect(columnIndex("AA")).toBe(26);
    expect(columnIndex("PB")).toBe(417);
    expect(decodeXml("&#228;&#x00FC;&quot;")).toBe('äü"');
  });

  it("refuses something that is not a zip", () => {
    expect(() => readXlsxRows(Buffer.from("not a zip at all, definitely not"))).toThrow(/ZIP/);
  });
});
