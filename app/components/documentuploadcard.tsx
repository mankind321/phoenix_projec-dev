import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DocumentUpload() {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 max-w-[1500px] mx-auto mt-6">
      <h2 className="text-lg font-semibold text-gray-900">Document Upload</h2>
      <p className="text-sm text-gray-500 mb-6">
        Upload PDF documents for automated data extraction
      </p>

      <div className="border-2 border-dashed border-gray-300 rounded-lg py-10 px-6 flex flex-col items-center justify-center text-center hover:border-blue-400 transition-colors">
        <Upload className="h-10 w-10 text-gray-400 mb-3" />

        <h3 className="text-base font-medium text-gray-800 mb-2">
          Upload PDF Documents
        </h3>
        <p className="text-sm text-gray-500 mb-4 max-w-md">
          Drag and drop PDF files here, or click to browse. Files will be
          automatically processed for data extraction.
        </p>

        <Button variant="default" className="px-5">
          Choose PDF Files
        </Button>
      </div>
    </div>
  );
}
