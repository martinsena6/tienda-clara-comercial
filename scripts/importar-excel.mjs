import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { createClient } from "@supabase/supabase-js";
import XLSX from "xlsx";

function loadEnv() {
  const envPath = path.resolve(".env");
  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]] !== undefined) continue;
    const value = match[2].replace(/^(['"])(.*)\1$/, "$2");
    process.env[match[1]] = value;
  }
}

function normalizeKey(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function matchingKeys(value) {
  const key = normalizeKey(value);
  const keys = new Set([key]);
  if (key.startsWith("alf") && !key.startsWith("alfajor")) {
    keys.add(`alfajor${key.slice(3)}`);
  }
  if (key.startsWith("goma") && !key.startsWith("gomitas")) {
    keys.add(`gomitas${key.slice(4)}`);
  }
  if (key.startsWith("chup") && !key.startsWith("chupetin")) {
    keys.add(`chupetines${key.slice(4)}`);
  }
  return [...keys];
}

function parseAmount(value, field, rowNumber, absolute = true) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`Número inválido en ${field}, fila ${rowNumber}`);
    return absolute ? Math.abs(value) : value;
  }

  let text = String(value)
    .trim()
    .replace(/[^\d,.-]/g, "");
  if (!text) return 0;

  const comma = text.lastIndexOf(",");
  const dot = text.lastIndexOf(".");
  if (comma >= 0 && dot >= 0) {
    text = comma > dot ? text.replace(/\./g, "").replace(",", ".") : text.replace(/,/g, "");
  } else if (comma >= 0) {
    text = /,\d{1,2}$/.test(text) ? text.replace(",", ".") : text.replace(/,/g, "");
  } else if (dot >= 0 && /\.\d{3}$/.test(text)) {
    text = text.replace(/\./g, "");
  }

  const parsed = Number(text);
  if (!Number.isFinite(parsed)) throw new Error(`Número inválido en ${field}, fila ${rowNumber}`);
  return absolute ? Math.abs(parsed) : parsed;
}

function dateToIso(year, month, day, rowNumber) {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error(`Fecha inválida en fila ${rowNumber}`);
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseDate(value, rowNumber) {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return dateToIso(value.getFullYear(), value.getMonth() + 1, value.getDate(), rowNumber);
  }
  if (typeof value === "number") {
    const parts = XLSX.SSF.parse_date_code(value);
    if (parts) return dateToIso(parts.y, parts.m, parts.d, rowNumber);
  }

  const text = String(value).trim();
  const dmy = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) return dateToIso(Number(dmy[3]), Number(dmy[2]), Number(dmy[1]), rowNumber);
  const ymd = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (ymd) return dateToIso(Number(ymd[1]), Number(ymd[2]), Number(ymd[3]), rowNumber);
  throw new Error(`Formato de vencimiento no reconocido en fila ${rowNumber}: ${text}`);
}

function readWorkbook(filePath) {
  if (!fs.existsSync(filePath)) throw new Error(`No se encontró el Excel: ${filePath}`);
  const workbook = XLSX.readFile(filePath, { cellDates: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new Error("El Excel no contiene hojas.");

  const rows = XLSX.utils.sheet_to_json(sheet, { raw: true, defval: "" });
  const products = rows.flatMap((row, index) => {
    const rowNumber = index + 2;
    const name = String(row.PRODUCTO ?? "").trim();
    if (!name) return [];

    const stockValue = parseAmount(row.STOCK, "STOCK", rowNumber, false);
    if (stockValue < 0)
      throw new Error(`El stock no puede ser negativo (fila ${rowNumber}: ${name})`);
    if (!Number.isInteger(stockValue)) {
      throw new Error(`El stock debe ser entero (fila ${rowNumber}: ${name})`);
    }

    return [
      {
        rowNumber,
        name,
        key: normalizeKey(name),
        stock: stockValue,
        cost: Number(parseAmount(row.Costo, "Costo", rowNumber).toFixed(2)),
        price: Math.round(
          parseAmount(row["VENTA TRANSFERENCIA"], "VENTA TRANSFERENCIA", rowNumber),
        ),
        expirationDate: parseDate(row["Fecha Vencimiento"], rowNumber),
      },
    ];
  });

  if (!products.length) throw new Error("No se encontraron productos en la primera hoja.");
  const duplicates = products.filter(
    (product, index) => products.findIndex((other) => other.key === product.key) !== index,
  );
  if (duplicates.length) {
    throw new Error(
      `Hay nombres de producto repetidos en el Excel: ${duplicates.map((item) => item.name).join(", ")}`,
    );
  }
  return products;
}

function matchProducts(excelProducts, catalogProducts) {
  const byKey = new Map();
  for (const product of catalogProducts) {
    for (const key of [normalizeKey(product.name), normalizeKey(product.slug)]) {
      if (!key) continue;
      const matches = byKey.get(key) ?? [];
      matches.push(product);
      byKey.set(key, matches);
    }
  }

  const matched = [];
  const unmatched = [];
  const ambiguous = [];
  for (const item of excelProducts) {
    const candidates = [...new Set(matchingKeys(item.name).flatMap((key) => byKey.get(key) ?? []))];
    if (candidates.length === 1) matched.push({ ...item, product: candidates[0] });
    else if (candidates.length > 1) ambiguous.push({ ...item, candidates });
    else unmatched.push(item);
  }
  return { matched, unmatched, ambiguous };
}

async function ask(question) {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  try {
    return (await rl.question(question)).trim();
  } finally {
    rl.close();
  }
}

async function askSecret(question) {
  if (!stdin.isTTY || typeof stdin.setRawMode !== "function") {
    throw new Error(
      "Ejecutá este script desde una terminal interactiva para ingresar la contraseña de forma segura.",
    );
  }

  stdout.write(question);
  stdin.setRawMode(true);
  stdin.resume();
  return new Promise((resolve, reject) => {
    let value = "";
    const cleanup = () => {
      stdin.removeListener("data", onData);
      stdin.setRawMode(false);
      stdout.write("\n");
    };
    const onData = (chunk) => {
      for (const char of chunk.toString()) {
        if (char === "\u0003") {
          cleanup();
          reject(new Error("Operación cancelada."));
          return;
        }
        if (char === "\r" || char === "\n") {
          cleanup();
          resolve(value);
          return;
        }
        if (char === "\u007f" || char === "\b") value = value.slice(0, -1);
        else value += char;
      }
    };
    stdin.on("data", onData);
  });
}

function backupPath(excelPath) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return path.join(path.dirname(excelPath), `respaldo-importacion-${stamp}.json`);
}

async function main() {
  loadEnv();
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const excelPath = path.resolve(
    args.find((arg) => !arg.startsWith("--")) ??
      path.join(os.homedir(), "Desktop", "excel para lovable.xlsx"),
  );
  const excelProducts = readWorkbook(excelPath);
  console.log(`Excel: ${excelPath}`);
  console.log(`Filas de productos válidas: ${excelProducts.length}`);
  if (args.includes("--check-only")) {
    console.log(`Precios en $0: ${excelProducts.filter((product) => product.price === 0).length}`);
    console.log(
      `Productos con vencimiento: ${excelProducts.filter((product) => product.expirationDate).length}`,
    );
    console.log("Validación local terminada; no se inició sesión ni se modificó la base de datos.");
    return;
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Faltan VITE_SUPABASE_URL o VITE_SUPABASE_PUBLISHABLE_KEY en .env");
  }

  const email = await ask("Correo de una cuenta administradora de Supabase: ");
  const password = await askSecret("Contraseña (no se muestra): ");
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
  if (signInError) throw new Error(`No se pudo iniciar sesión: ${signInError.message}`);

  const { error: permissionError } = await supabase.rpc("apply_stock_count", {
    p_counts: [],
    p_reason: "Verificación de permisos para importar Excel",
  });
  if (permissionError) {
    throw new Error(
      `La cuenta debe tener rol admin y acceso a apply_stock_count: ${permissionError.message}`,
    );
  }

  const { data: catalogProducts, error: catalogError } = await supabase
    .from("products_staff")
    .select("id, name, slug, price, cost, stock, active, image_url, image_urls, expiration_date");
  if (catalogError)
    throw new Error(`No se pudo leer el catálogo del personal: ${catalogError.message}`);

  const { matched, unmatched, ambiguous } = matchProducts(excelProducts, catalogProducts ?? []);
  console.log(`\nCoincidencias exactas y seguras: ${matched.length}`);
  console.log(`Sin coincidencia: ${unmatched.length}`);
  console.log(`Coincidencias ambiguas: ${ambiguous.length}`);
  if (matched.length) {
    console.log("\nProductos que se actualizarían:");
    for (const item of matched) {
      console.log(
        `- ${item.name} -> ${item.product.name}: stock ${item.stock}, costo $${item.cost}, ` +
          `venta $${item.price}, vencimiento ${item.expirationDate ?? "sin fecha"}`,
      );
    }
  }
  if (unmatched.length) {
    console.log("\nSe omitirán estos productos hasta corregir sus nombres o revisar el catálogo:");
    for (const product of unmatched) console.log(`- Fila ${product.rowNumber}: ${product.name}`);
  }
  if (ambiguous.length) {
    console.log("\nSe omitirán estos productos porque coinciden con más de un registro:");
    for (const item of ambiguous) {
      console.log(
        `- Fila ${item.rowNumber}: ${item.name} -> ${item.candidates.map((candidate) => candidate.name).join(" / ")}`,
      );
    }
  }
  if (!matched.length)
    throw new Error("No hay productos con coincidencia segura; no se modificó nada.");
  if (!apply) {
    console.log("\nVista previa solamente. No se modificó la base de datos.");
    console.log(
      "Cuando revises el resultado, repetí el comando agregando --apply para importar las coincidencias seguras.",
    );
    return;
  }

  const confirmation = await ask(
    `\nSe actualizarán ${matched.length} productos: stock, costo, precio, vencimiento y fotos. ` +
      `Los precios $0 quedarán en $0. Escribí IMPORTAR ${matched.length} para continuar: `,
  );
  if (confirmation !== `IMPORTAR ${matched.length}`) {
    console.log("Cancelado; no se modificó la base de datos.");
    return;
  }

  const backupFile = backupPath(excelPath);
  fs.writeFileSync(
    backupFile,
    JSON.stringify(
      matched.map(({ product }) => ({
        id: product.id,
        name: product.name,
        price: product.price,
        cost: product.cost,
        stock: product.stock,
        active: product.active,
        expiration_date: product.expiration_date,
        image_url: product.image_url,
        image_urls: product.image_urls,
      })),
      null,
      2,
    ),
  );
  console.log(`Respaldo previo guardado en: ${backupFile}`);

  try {
    const priceChanges = matched.map((item) => ({
      product_id: item.product.id,
      new_price: item.price,
    }));
    const { error: priceError } = await supabase.rpc("apply_price_changes", {
      p_changes: priceChanges,
      p_reason: "Importación de precios desde Excel",
    });
    if (priceError) throw new Error(`Falló la actualización de precios: ${priceError.message}`);

    const costRows = matched.map((item) => ({
      product_id: item.product.id,
      cost: item.cost,
      supplier: null,
    }));
    const { error: costError } = await supabase.rpc("apply_costs", { p_rows: costRows });
    if (costError) throw new Error(`Falló la actualización de costos: ${costError.message}`);

    const stockCounts = matched.map((item) => ({
      product_id: item.product.id,
      counted: item.stock,
    }));
    const { error: stockError } = await supabase.rpc("apply_stock_count", {
      p_counts: stockCounts,
      p_reason: "Importación de stock desde Excel",
    });
    if (stockError) throw new Error(`Falló la actualización de stock: ${stockError.message}`);

    for (const item of matched) {
      const { error } = await supabase
        .from("products")
        .update({
          expiration_date: item.expirationDate,
          image_url: "",
          image_urls: [],
        })
        .eq("id", item.product.id)
        .select("id")
        .single();
      if (error) {
        throw new Error(`Falló vencimiento/fotos de "${item.product.name}": ${error.message}`);
      }
    }
  } catch (error) {
    throw new Error(
      `${error.message} La importación pudo quedar parcial; revisá el respaldo ${backupFile} antes de reintentar.`,
    );
  }

  console.log(`\nImportación completada: ${matched.length} productos actualizados.`);
  console.log(`Se limpiaron las fotos solo de los productos coincidentes. Respaldo: ${backupFile}`);
  if (unmatched.length || ambiguous.length) {
    console.log("Los productos sin coincidencia segura quedaron sin modificar.");
  }
}

main().catch((error) => {
  console.error(`\nError: ${error.message}`);
  process.exitCode = 1;
});
