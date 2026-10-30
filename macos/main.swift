import AppKit
import WebKit

final class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate, WKUIDelegate, WKDownloadDelegate {
    private let server = ServerManager()
    private var window: NSWindow!
    private var webView: WKWebView!
    private var lastError: Error?

    func applicationDidFinishLaunching(_ notification: Notification) {
        buildMainMenu()
        buildWindow()
        startLab()
    }

    func applicationWillTerminate(_ notification: Notification) {
        server.stopOwnedServer()
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        true
    }

    private func buildWindow() {
        window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 1440, height: 960),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = "Partner Readiness Lab"
        window.minSize = NSSize(width: 800, height: 600)
        window.center()
        window.setFrameAutosaveName("PartnerReadinessLabMainWindow")

        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        webView = WKWebView(frame: window.contentView!.bounds, configuration: configuration)
        webView.autoresizingMask = [.width, .height]
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = true
        window.contentView!.addSubview(webView)
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    private func startLab() {
        window.title = "Partner Readiness Lab - Starting"
        server.start { result in
            DispatchQueue.main.async {
                switch result {
                case .success:
                    self.window.title = "Partner Readiness Lab"
                    self.lastError = nil
                    self.webView.load(URLRequest(url: self.server.labURL))
                    self.captureIfRequested()
                case .failure(let error):
                    self.lastError = error
                    self.window.title = "Partner Readiness Lab - Local lab unavailable"
                    self.showFailure(error)
                }
            }
        }
    }

    private static func argument(named name: String) -> String? {
        guard let index = CommandLine.arguments.firstIndex(of: name), index + 1 < CommandLine.arguments.count else {
            return nil
        }
        return CommandLine.arguments[index + 1]
    }

    private func captureIfRequested() {
        guard let path = Self.argument(named: "--capture") else { return }
        DispatchQueue.main.asyncAfter(deadline: .now() + 4) {
            let script = Self.argument(named: "--script") ?? ""
            self.webView.evaluateJavaScript(script) { result, error in
                if let result = result { print("Script result: \(result)") }
                if let error = error { fputs("Script failed: \(error.localizedDescription)\n", stderr) }
                DispatchQueue.main.asyncAfter(deadline: .now() + 2) {
                    let stateScript = "JSON.stringify({url: location.href, title: document.title, status: document.querySelector('#session-status')?.textContent || '', heading: document.querySelector('#lab-title')?.textContent || ''})"
                    self.webView.evaluateJavaScript(stateScript) { result, _ in
                        if let result = result { print("Browser state: \(result)") }
                        self.webView.takeSnapshot(with: nil) { image, error in
                            guard let data = image?.tiffRepresentation,
                                  let bitmap = NSBitmapImageRep(data: data),
                                  let png = bitmap.representation(using: .png, properties: [:]) else {
                                fputs("Capture failed: \(error?.localizedDescription ?? "image conversion")\n", stderr)
                                NSApp.terminate(nil)
                                return
                            }
                            do {
                                try png.write(to: URL(fileURLWithPath: path))
                            } catch {
                                fputs("Capture failed: \(error.localizedDescription)\n", stderr)
                            }
                            NSApp.terminate(nil)
                        }
                    }
                }
            }
        }
    }

    private func showFailure(_ error: Error) {
        let alert = NSAlert()
        alert.alertStyle = .warning
        alert.messageText = "Partner Readiness Lab could not load"
        alert.informativeText = error.localizedDescription
        alert.addButton(withTitle: "Retry")
        alert.addButton(withTitle: "Quit")
        if alert.runModal() == .alertFirstButtonReturn {
            startLab()
        } else {
            NSApp.terminate(nil)
        }
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        guard (error as NSError).code != NSURLErrorCancelled else { return }
        showFailure(error)
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        guard (error as NSError).code != NSURLErrorCancelled else { return }
        showFailure(error)
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.allow)
            return
        }
        if let scheme = url.scheme?.lowercased(), scheme == "http" || scheme == "https" {
            if !isLocalLabURL(url) {
                NSWorkspace.shared.open(url)
                decisionHandler(.cancel)
                return
            }
        }
        if navigationAction.targetFrame == nil {
            webView.load(navigationAction.request)
            decisionHandler(.cancel)
            return
        }
        decisionHandler(.allow)
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url {
            if isLocalLabURL(url) {
                webView.load(navigationAction.request)
            } else if let scheme = url.scheme?.lowercased(), scheme == "http" || scheme == "https" {
                NSWorkspace.shared.open(url)
            }
        }
        return nil
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationResponse: WKNavigationResponse,
                 decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        decisionHandler(navigationResponse.canShowMIMEType ? .allow : .download)
    }

    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) {
        download.delegate = self
    }

    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) {
        download.delegate = self
    }

    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse,
                  suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) {
        let panel = NSSavePanel()
        panel.nameFieldStringValue = suggestedFilename
        panel.beginSheetModal(for: window) { result in
            completionHandler(result == .OK ? panel.url : nil)
        }
    }

    @available(macOS 12.0, *)
    func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin,
                 initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType,
                 decisionHandler: @escaping (WKPermissionDecision) -> Void) {
        decisionHandler(type == .microphone ? .grant : .deny)
    }

    private func isLocalLabURL(_ url: URL) -> Bool {
        guard url.scheme?.lowercased() == "http",
              url.host == "127.0.0.1" || url.host == "localhost" else { return false }
        return (url.port ?? 80) == 8766
    }

    private func buildMainMenu() {
        let mainMenu = NSMenu()
        let appItem = NSMenuItem()
        mainMenu.addItem(appItem)
        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "About Partner Readiness Lab", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "Quit Partner Readiness Lab", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        appItem.submenu = appMenu

        let fileItem = NSMenuItem()
        mainMenu.addItem(fileItem)
        let fileMenu = NSMenu(title: "File")
        fileMenu.addItem(withTitle: "Print / Save PDF", action: #selector(printDocument), keyEquivalent: "p")
        fileItem.submenu = fileMenu

        let editItem = NSMenuItem()
        mainMenu.addItem(editItem)
        let editMenu = NSMenu(title: "Edit")
        editMenu.addItem(withTitle: "Cut", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        editMenu.addItem(withTitle: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        editMenu.addItem(withTitle: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        editMenu.addItem(withTitle: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
        editItem.submenu = editMenu

        let viewItem = NSMenuItem()
        mainMenu.addItem(viewItem)
        let viewMenu = NSMenu(title: "View")
        viewMenu.addItem(withTitle: "Reload", action: #selector(reload), keyEquivalent: "r")
        viewMenu.addItem(withTitle: "Back", action: #selector(goBack), keyEquivalent: "[")
        viewItem.submenu = viewMenu

        NSApp.mainMenu = mainMenu
    }

    @objc private func printDocument() {
        let operation = webView.printOperation(with: NSPrintInfo.shared)
        operation.showsPrintPanel = true
        operation.runModal(for: window, delegate: nil, didRun: nil, contextInfo: nil)
    }

    @objc private func reload() {
        if lastError != nil {
            startLab()
        } else {
            webView.reload()
        }
    }

    @objc private func goBack() {
        webView.goBack()
    }
}

let application = NSApplication.shared
let delegate = AppDelegate()
application.setActivationPolicy(.regular)
application.delegate = delegate
application.run()
