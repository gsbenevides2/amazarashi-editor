export function invalidateISG() {
  fetch("https://amazarashi.gui.dev.br/api/isg", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.ISG_SECRET_KEY}`,
    },
  });
}
