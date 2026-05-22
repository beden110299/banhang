async function test() {
  try {
    const res = await fetch('http://localhost:5000/api/admin/transactions');
    console.log("Response status:", res.status);
    const data = await res.json();
    console.log("Response body size:", data.length);
    console.log("Response data:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Fetch failed:", err);
  }
}

test();
