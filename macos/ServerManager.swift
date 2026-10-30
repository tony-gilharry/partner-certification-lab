import Darwin
import Foundation

final class ServerManager {
    enum ServerError: LocalizedError {
        case missingResources(String)
        case incompatibleService
        case launchFailed(String)
        case timeout

        var errorDescription: String? {
            switch self {
            case .missingResources(let path):
                return "The app is missing its packaged web files or local server. Rebuild it with npm run app. Expected resources near: \(path)"
            case .incompatibleService:
                return "Port 8766 is occupied by another service. Stop that service, then reopen Partner Readiness Lab."
            case .launchFailed(let message):
                return "Could not start the local lab: \(message)"
            case .timeout:
                return "The local lab did not become ready within 30 seconds. Check that /usr/bin/python3 is available, then retry."
            }
        }
    }

    private let baseURL = URL(string: "http://127.0.0.1:8766")!
    private let healthURL = URL(string: "http://127.0.0.1:8766/api/health")!
    private let queue = DispatchQueue(label: "local.tonygilharry.partner-readiness-lab.server", qos: .userInitiated)
    private var child: Process?
    private var session: URLSession?

    var labURL: URL { baseURL }

    func start(completion: @escaping (Result<Void, Error>) -> Void) {
        queue.async {
            guard let resources = self.packagedResources() else {
                let expected = Bundle.main.resourceURL?.path ?? "the app bundle"
                completion(.failure(ServerError.missingResources(expected)))
                return
            }

            self.checkHealth { compatible in
                if compatible {
                    completion(.success(()))
                    return
                }

                self.queue.async {
                    if self.isPortOpen() {
                        completion(.failure(ServerError.incompatibleService))
                    } else {
                        self.launch(resources: resources, completion: completion)
                    }
                }
            }
        }
    }

    func stopOwnedServer() {
        queue.sync {
            guard let child = child, child.isRunning else { return }
            child.terminate()
        }
    }

    private func packagedResources() -> URL? {
        guard let resources = Bundle.main.resourceURL else { return nil }
        let server = resources.appendingPathComponent("desktop_server.py")
        let index = resources.appendingPathComponent("web/index.html")
        guard FileManager.default.isReadableFile(atPath: server.path),
              FileManager.default.isReadableFile(atPath: index.path) else { return nil }
        return resources
    }

    private func launch(resources: URL, completion: @escaping (Result<Void, Error>) -> Void) {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/python3")
        process.arguments = [resources.appendingPathComponent("desktop_server.py").path]
        process.currentDirectoryURL = resources
        process.standardInput = FileHandle.nullDevice
        process.standardOutput = FileHandle.nullDevice
        process.standardError = FileHandle.nullDevice

        do {
            try process.run()
            child = process
        } catch {
            completion(.failure(ServerError.launchFailed(error.localizedDescription)))
            return
        }

        pollUntilReady(attempt: 0, completion: completion)
    }

    private func pollUntilReady(attempt: Int, completion: @escaping (Result<Void, Error>) -> Void) {
        checkHealth { compatible in
            self.queue.async {
                if compatible {
                    completion(.success(()))
                    return
                }
                if let child = self.child, !child.isRunning {
                    completion(.failure(ServerError.launchFailed("The server exited with status \(child.terminationStatus).")))
                    return
                }
                guard attempt < 119 else {
                    if let child = self.child, child.isRunning {
                        child.terminate()
                        self.child = nil
                    }
                    completion(.failure(ServerError.timeout))
                    return
                }
                self.queue.asyncAfter(deadline: .now() + 0.25) {
                    self.pollUntilReady(attempt: attempt + 1, completion: completion)
                }
            }
        }
    }

    private func checkHealth(completion: @escaping (Bool) -> Void) {
        let request = URLRequest(url: healthURL, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 1)
        let configuration = URLSessionConfiguration.ephemeral
        configuration.timeoutIntervalForRequest = 1
        configuration.timeoutIntervalForResource = 2
        let session = URLSession(configuration: configuration)
        self.session = session
        session.dataTask(with: request) { data, response, _ in
            defer {
                session.finishTasksAndInvalidate()
                self.session = nil
            }
            guard let http = response as? HTTPURLResponse, http.statusCode == 200,
                  let data = data,
                  let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                completion(false)
                return
            }
            completion(object["service"] as? String == "partner-readiness-lab" && object["version"] as? Int == 1)
        }.resume()
    }

    private func isPortOpen() -> Bool {
        let descriptor = socket(AF_INET, SOCK_STREAM, 0)
        guard descriptor >= 0 else { return false }
        defer { close(descriptor) }

        var address = sockaddr_in()
        address.sin_len = UInt8(MemoryLayout<sockaddr_in>.size)
        address.sin_family = sa_family_t(AF_INET)
        address.sin_port = in_port_t(8766).bigEndian
        inet_pton(AF_INET, "127.0.0.1", &address.sin_addr)

        return withUnsafePointer(to: &address) {
            $0.withMemoryRebound(to: sockaddr.self, capacity: 1) {
                connect(descriptor, $0, socklen_t(MemoryLayout<sockaddr_in>.size)) == 0
            }
        }
    }
}
