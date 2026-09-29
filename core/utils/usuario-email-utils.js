function extrairEmailsUnicos(usuarioList = []) {
  const emails = usuarioList
    .map(u => (u && u.email ? String(u.email).trim().toLowerCase() : ''))
    .filter(Boolean);

  return [...new Set(emails)];
}

module.exports = {
  extrairEmailsUnicos,
};
