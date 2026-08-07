const MENU_ID = 'scan-mcp-install-selection'
let pendingSelection = ''

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: 'Scan selected MCP setup',
      contexts: ['selection'],
    })
  })
})

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId !== MENU_ID || !info.selectionText) return
  pendingSelection = info.selectionText.slice(0, 100_000)
  try {
    await chrome.action.openPopup()
  } catch {
    await chrome.action.setBadgeBackgroundColor({ color: '#ef8f75' })
    await chrome.action.setBadgeText({ text: '!' })
  }
})

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'consume-selection') return false
  const selection = pendingSelection
  pendingSelection = ''
  chrome.action.setBadgeText({ text: '' })
  sendResponse({ selection })
  return false
})
