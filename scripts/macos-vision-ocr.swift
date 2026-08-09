import AppKit
import Foundation
import Vision

func recognizeText(path: String) -> String {
    guard let image = NSImage(contentsOfFile: path),
          let tiff = image.tiffRepresentation,
          let bitmap = NSBitmapImageRep(data: tiff),
          let cgImage = bitmap.cgImage else {
        return ""
    }

    var output: [String] = []
    let request = VNRecognizeTextRequest { request, error in
        if error != nil { return }
        let observations = (request.results as? [VNRecognizedTextObservation]) ?? []
        let sorted = observations.sorted {
            if abs($0.boundingBox.midY - $1.boundingBox.midY) > 0.015 {
                return $0.boundingBox.midY > $1.boundingBox.midY
            }
            return $0.boundingBox.minX < $1.boundingBox.minX
        }
        output = sorted.compactMap { observation in
            observation.topCandidates(1).first?.string.trimmingCharacters(in: .whitespacesAndNewlines)
        }.filter { !$0.isEmpty }
    }

    request.recognitionLevel = .accurate
    request.usesLanguageCorrection = true
    request.recognitionLanguages = ["zh-Hans", "zh-Hant", "en-US"]

    let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
    do {
        try handler.perform([request])
    } catch {
        return ""
    }
    return output.joined(separator: "\n")
}

let paths = Array(CommandLine.arguments.dropFirst())
if paths.isEmpty {
    exit(1)
}

var sections: [String] = []
for (index, path) in paths.enumerated() {
    let text = recognizeText(path: path)
    let body = text.isEmpty ? "[未识别到清晰文字]" : text
    sections.append("## 图片\(index + 1)\n\(body)")
}

print(sections.joined(separator: "\n\n---\n\n"))
