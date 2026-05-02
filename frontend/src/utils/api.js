import axios from 'axios'

const BASE = '/api'

export const api = {
  getJournals: () =>
    axios.get(`${BASE}/journals`).then((r) => r.data),

  getJournalRules: (journalId) =>
    axios.get(`${BASE}/journals/${journalId}`).then((r) => r.data),

  precheckManuscript: (manuscript, journalId) =>
    axios.post(`${BASE}/journals/${journalId}/precheck`, { manuscript, journal_id: journalId }).then((r) => r.data),

  parseManuscript: (file) => {
    const form = new FormData()
    form.append('file', file)
    return axios.post(`${BASE}/parse`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data)
  },

  formatManuscript: (manuscript, journalId, mode) =>
    axios.post(`${BASE}/format`, { manuscript, journal_id: journalId, mode }).then((r) => r.data),

  applyChanges: (manuscript, changes) =>
    axios.post(`${BASE}/apply-changes`, { manuscript, changes }).then((r) => r.data),

  getCompliance: (manuscript, journalId) =>
    axios.post(`${BASE}/compliance`, { manuscript, journal_id: journalId }).then((r) => r.data),

  exportClean: async (manuscript, changes, journalId) => {
    const res = await axios.post(
      `${BASE}/export/clean`,
      { manuscript, changes, journal_id: journalId, export_mode: 'clean' },
      { responseType: 'blob' }
    )
    return res.data
  },

  exportTracked: async (manuscript, changes, journalId) => {
    const res = await axios.post(
      `${BASE}/export/tracked`,
      { manuscript, changes, journal_id: journalId, export_mode: 'tracked' },
      { responseType: 'blob' }
    )
    return res.data
  },
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
