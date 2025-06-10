import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Sender from './components/Sender';
import Receiver from './components/Receiver';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-100">
        {/* Navigation */}
        <nav className="bg-white shadow-lg">
          <div className="max-w-6xl mx-auto px-4">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center">
                <Link to="/" className="text-2xl font-bold text-gray-800">
                  QR Transfer
                </Link>
              </div>
              <div className="flex space-x-4">
                <Link
                  to="/send"
                  className="px-4 py-2 rounded-md text-gray-700 hover:text-blue-600 hover:bg-gray-50 transition-colors"
                >
                  Send
                </Link>
                <Link
                  to="/receive"
                  className="px-4 py-2 rounded-md text-gray-700 hover:text-blue-600 hover:bg-gray-50 transition-colors"
                >
                  Receive
                </Link>
              </div>
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <div className="container mx-auto py-8">
          <Routes>
            <Route path="/send" element={<Sender />} />
            <Route path="/receive" element={<Receiver />} />
            <Route path="/" element={<HomePage />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

const HomePage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto text-center p-6">
      <div className="bg-white rounded-lg shadow-lg p-12">
        <h1 className="text-5xl font-bold text-gray-800 mb-6">
          QR Transfer
        </h1>
        <p className="text-xl text-gray-600 mb-12">
          Transfer files between devices using QR codes
        </p>
        
        <div className="grid md:grid-cols-2 gap-8 mb-12">
          <div className="p-8 border-2 border-gray-200 rounded-lg hover:border-blue-400 transition-colors">
            <div className="text-4xl mb-4">📤</div>
            <h3 className="text-2xl font-semibold text-gray-800 mb-3">Send Files</h3>
            <p className="text-gray-600 mb-6">
              Upload a file and generate QR codes to transfer it to another device
            </p>
            <Link
              to="/send"
              className="inline-block px-8 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Start Sending
            </Link>
          </div>

          <div className="p-8 border-2 border-gray-200 rounded-lg hover:border-green-400 transition-colors">
            <div className="text-4xl mb-4">📥</div>
            <h3 className="text-2xl font-semibold text-gray-800 mb-3">Receive Files</h3>
            <p className="text-gray-600 mb-6">
              Use your camera to scan QR codes and receive files from another device
            </p>
            <Link
              to="/receive"
              className="inline-block px-8 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
            >
              Start Receiving
            </Link>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-8">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">How it Works</h3>
          <div className="grid md:grid-cols-3 gap-6 text-left">
            <div>
              <div className="bg-blue-100 rounded-full w-12 h-12 flex items-center justify-center mb-4 mx-auto">
                <span className="text-blue-600 font-bold">1</span>
              </div>
              <h4 className="font-semibold text-gray-800 mb-2">Upload File</h4>
              <p className="text-sm text-gray-600">
                Select or drag a file to the sender interface
              </p>
            </div>
            <div>
              <div className="bg-green-100 rounded-full w-12 h-12 flex items-center justify-center mb-4 mx-auto">
                <span className="text-green-600 font-bold">2</span>
              </div>
              <h4 className="font-semibold text-gray-800 mb-2">Scan QR Codes</h4>
              <p className="text-sm text-gray-600">
                Use the receiver to scan the generated QR codes
              </p>
            </div>
            <div>
              <div className="bg-purple-100 rounded-full w-12 h-12 flex items-center justify-center mb-4 mx-auto">
                <span className="text-purple-600 font-bold">3</span>
              </div>
              <h4 className="font-semibold text-gray-800 mb-2">Download File</h4>
              <p className="text-sm text-gray-600">
                The file is automatically reconstructed and downloaded
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 text-sm text-gray-500">
          <p>
            Secure, offline file transfer using QR codes. No internet connection required.
          </p>
        </div>
      </div>
    </div>
  );
};

export default App;