import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import Sender from './components/Sender';
import Receiver from './components/Receiver';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
        <Navigation />
        
        {/* Main Content */}
        <div className="container mx-auto py-4 sm:py-8 px-4">
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

const Navigation: React.FC = () => {
  const location = useLocation();
  
  const isActive = (path: string) => location.pathname === path;
  
  return (
    <nav className="bg-gradient-to-r from-blue-600/90 to-purple-600/90 backdrop-blur-md shadow-xl border-b border-white/20 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 lg:px-6">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link to="/" className="text-xl sm:text-2xl font-bold text-white hover:text-blue-100 transition-all duration-300">
              QR Transfer
            </Link>
          </div>
          <div className="flex space-x-1 sm:space-x-2">
            <Link
              to="/send"
              className={`px-2 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-300 ${
                isActive('/send')
                  ? 'bg-white text-blue-600 shadow-lg shadow-blue-600/25'
                  : 'text-white/80 hover:text-white hover:bg-white/20'
              }`}
            >
              <span className="sm:hidden">📤</span>
              <span className="hidden sm:inline">📤 Send</span>
            </Link>
            <Link
              to="/receive"
              className={`px-2 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-300 ${
                isActive('/receive')
                  ? 'bg-white text-green-600 shadow-lg shadow-green-600/25'
                  : 'text-white/80 hover:text-white hover:bg-white/20'
              }`}
            >
              <span className="sm:hidden">📥</span>
              <span className="hidden sm:inline">📥 Receive</span>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
};

const HomePage: React.FC = () => {
  return (
    <div className="max-w-6xl mx-auto text-center">
      {/* Hero Section */}
      <div className="mb-16">
        <div className="bg-gradient-to-br from-white/80 to-blue-50/80 backdrop-blur-sm rounded-2xl sm:rounded-3xl shadow-2xl shadow-purple-500/20 p-4 sm:p-8 lg:p-16 border border-white/30">
          <div className="mb-8">
            <h1 className="text-2xl sm:text-4xl lg:text-6xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-4 sm:mb-6 leading-tight">
              QR Transfer
            </h1>
            <p className="text-base sm:text-xl lg:text-2xl text-gray-600 mb-6 sm:mb-8 max-w-3xl mx-auto leading-relaxed">
              Transfer files between devices using QR codes - secure, fast, and completely offline
            </p>
          </div>
          
          <div className="grid sm:grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8 mb-8 sm:mb-12">
            <div className="group relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 rounded-2xl blur-xl opacity-30 group-hover:opacity-50 transition-opacity duration-300"></div>
              <div className="relative bg-gradient-to-br from-white to-blue-50/50 border border-blue-200/50 rounded-xl sm:rounded-2xl p-4 sm:p-8 hover:border-purple-300/70 transition-all duration-300 group-hover:shadow-2xl group-hover:shadow-purple-500/30 group-hover:-translate-y-1">
                <div className="text-3xl sm:text-5xl mb-4 sm:mb-6">📤</div>
                <h3 className="text-xl sm:text-2xl font-bold text-gray-800 mb-3 sm:mb-4">Send Files</h3>
                <p className="text-gray-600 mb-6 sm:mb-8 text-sm sm:text-lg leading-relaxed">
                  Upload any file and generate QR codes to transfer it securely to another device
                </p>
                <Link
                  to="/send"
                  className="inline-flex items-center px-4 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-medium rounded-lg sm:rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all duration-300 shadow-lg shadow-purple-600/30 hover:shadow-xl hover:shadow-purple-600/50 hover:-translate-y-0.5 text-sm sm:text-base"
                >
                  Start Sending
                  <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </Link>
              </div>
            </div>

            <div className="group relative">
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl blur-xl opacity-30 group-hover:opacity-50 transition-opacity duration-300"></div>
              <div className="relative bg-gradient-to-br from-white to-emerald-50/50 border border-emerald-200/50 rounded-xl sm:rounded-2xl p-4 sm:p-8 hover:border-teal-300/70 transition-all duration-300 group-hover:shadow-2xl group-hover:shadow-emerald-500/30 group-hover:-translate-y-1">
                <div className="text-3xl sm:text-5xl mb-4 sm:mb-6">📥</div>
                <h3 className="text-xl sm:text-2xl font-bold text-gray-800 mb-3 sm:mb-4">Receive Files</h3>
                <p className="text-gray-600 mb-6 sm:mb-8 text-sm sm:text-lg leading-relaxed">
                  Use your camera to scan QR codes and receive files from another device instantly
                </p>
                <Link
                  to="/receive"
                  className="inline-flex items-center px-4 sm:px-8 py-3 sm:py-4 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-medium rounded-lg sm:rounded-xl hover:from-emerald-600 hover:to-teal-700 transition-all duration-300 shadow-lg shadow-emerald-600/30 hover:shadow-xl hover:shadow-emerald-600/50 hover:-translate-y-0.5 text-sm sm:text-base"
                >
                  Start Receiving
                  <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* How it Works Section */}
      <div className="bg-gradient-to-br from-white/70 to-purple-50/70 backdrop-blur-sm rounded-2xl sm:rounded-3xl shadow-xl shadow-purple-500/20 p-4 sm:p-8 lg:p-12 border border-white/30 mb-8 sm:mb-12">
        <h3 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-6 sm:mb-12">How it Works</h3>
        <div className="grid sm:grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
          <div className="group">
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-400 to-blue-600 rounded-full blur-lg opacity-30 group-hover:opacity-50 transition-opacity duration-300"></div>
              <div className="relative bg-gradient-to-r from-cyan-500 to-blue-600 rounded-full w-16 h-16 flex items-center justify-center mx-auto">
                <span className="text-white font-bold text-xl">1</span>
              </div>
            </div>
            <h4 className="font-bold text-gray-800 mb-3 sm:mb-4 text-lg sm:text-xl">Upload File</h4>
            <p className="text-gray-600 leading-relaxed text-sm sm:text-base">
              Select or drag any file to the sender interface. Files are processed locally on your device.
            </p>
          </div>
          <div className="group">
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-cyan-600 rounded-full blur-lg opacity-30 group-hover:opacity-50 transition-opacity duration-300"></div>
              <div className="relative bg-gradient-to-r from-emerald-500 to-cyan-600 rounded-full w-16 h-16 flex items-center justify-center mx-auto">
                <span className="text-white font-bold text-xl">2</span>
              </div>
            </div>
            <h4 className="font-bold text-gray-800 mb-3 sm:mb-4 text-lg sm:text-xl">Scan QR Codes</h4>
            <p className="text-gray-600 leading-relaxed text-sm sm:text-base">
              Use the receiver to scan the generated QR codes. Each code contains a chunk of your file.
            </p>
          </div>
          <div className="group">
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-400 to-pink-600 rounded-full blur-lg opacity-30 group-hover:opacity-50 transition-opacity duration-300"></div>
              <div className="relative bg-gradient-to-r from-purple-500 to-pink-600 rounded-full w-16 h-16 flex items-center justify-center mx-auto">
                <span className="text-white font-bold text-xl">3</span>
              </div>
            </div>
            <h4 className="font-bold text-gray-800 mb-3 sm:mb-4 text-lg sm:text-xl">Download File</h4>
            <p className="text-gray-600 leading-relaxed text-sm sm:text-base">
              Your file is automatically reconstructed and downloaded once all codes are scanned.
            </p>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="bg-gradient-to-r from-indigo-100 to-purple-100 rounded-2xl sm:rounded-3xl p-4 sm:p-8 lg:p-12 border border-indigo-200/50">
        <div className="flex flex-wrap justify-center gap-3 sm:gap-6 text-xs sm:text-sm">
          <div className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-full px-3 sm:px-4 py-2 shadow-lg">
            <div className="w-2 h-2 bg-white rounded-full"></div>
            <span className="font-medium">Secure & Private</span>
          </div>
          <div className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-full px-3 sm:px-4 py-2 shadow-lg">
            <div className="w-2 h-2 bg-white rounded-full"></div>
            <span className="font-medium">No Internet Required</span>
          </div>
          <div className="flex items-center gap-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full px-3 sm:px-4 py-2 shadow-lg">
            <div className="w-2 h-2 bg-white rounded-full"></div>
            <span className="font-medium">Works Offline</span>
          </div>
          <div className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-full px-3 sm:px-4 py-2 shadow-lg">
            <div className="w-2 h-2 bg-white rounded-full"></div>
            <span className="font-medium">Any File Type</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;