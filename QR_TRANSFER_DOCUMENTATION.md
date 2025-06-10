# QR Transfer Algorithm Documentation

## Overview

QrXfer is a file transfer system that uses QR codes to transmit data between devices. It splits files into chunks, encodes them as QR codes, and displays them sequentially for scanning by a receiving device with a camera.

## Core Components

### QrSend Class
**Purpose**: Splits data into chunks and generates QR codes for transmission

**Key Methods**:
- `__init__(size=30, data=None)`: Initialize with chunk size and data
- `_chunks()`: Split data into equal-sized chunks (qrxfer.py:50)
- `_headers()`: Generate protocol headers with metadata (qrxfer.py:56)
- `send()`: Display QR codes sequentially (qrxfer.py:69)

### QrReceive Class
**Purpose**: Captures QR codes via camera and reconstructs original data

**Key Methods**:
- `process_frames()`: Continuous camera capture and QR scanning (qrxfer.py:119)
- `process_symbol()`: Parse individual QR codes and handle protocol (qrxfer.py:146)

## Transfer Protocol

### 1. Header Phase
```
-----BEGIN XFER MESSAGE-----
-----BEGIN XFER HEADER-----
LEN:<number_of_chunks>
HASH:<sha1_hash_of_complete_data>
-----END XFER HEADER-----
```

### 2. Data Phase
Each chunk is transmitted as:
```
<10_digit_sequence_number>:<base64_encoded_data>
```

### 3. End Phase
```
-----END XFER MESSAGE-----
```

## Algorithm Flow

### Sender Process
1. **Data Preparation**: Split file into chunks of specified size (default 30 bytes)
2. **Header Generation**: Create metadata (length, hash) for integrity checking
3. **QR Generation**: Convert each chunk to base64 and create QR code
4. **Sequential Display**: Show QR codes with timing delays (0.5s for headers, 0.2s for data)

### Receiver Process
1. **Camera Initialization**: Start video capture and QR scanner
2. **Header Processing**: Parse metadata to prepare for data reception
3. **Data Collection**: Decode base64 chunks and track sequence numbers
4. **Integrity Verification**: Compare received data hash with expected hash
5. **File Reconstruction**: Combine chunks into original file

## Key Features

### Error Handling
- **Duplicate Detection**: Prevents processing same chunk twice (qrxfer.py:187)
- **Sequence Tracking**: Detects missing or out-of-order chunks (qrxfer.py:192)
- **Hash Verification**: Ensures data integrity with SHA1 checksum (qrxfer.py:175)

### Reliability Mechanisms
- **Context Manager**: Proper camera resource cleanup (qrxfer.py:112-117)
- **Position Tracking**: Maintains chunk sequence order
- **Visual Feedback**: Progress indicators and status messages

## Technical Dependencies

- **pyqrcode**: QR code generation
- **zbar**: QR code scanning
- **opencv (cv2)**: Camera capture and image processing
- **click**: CLI interface
- **base64**: Data encoding
- **hashlib**: Data integrity verification

## Limitations

1. **Sequential Transfer**: No parallel or random access transmission
2. **Camera Dependency**: Requires functioning camera on receiving device
3. **Lighting Conditions**: Performance affected by ambient light and screen quality
4. **Size Constraints**: Large files require many QR codes and extended transfer time
5. **Error Recovery**: Limited ability to recover from missed chunks

## Web Interface Design Considerations

### Sender Interface Requirements
- File upload/selection capability
- Chunk size configuration
- QR code display area with timing controls
- Progress tracking and status indicators
- Manual navigation between QR codes

### Receiver Interface Requirements
- Camera access and preview
- Real-time QR code scanning
- Progress visualization
- File download capability
- Error status and retry mechanisms

### Technical Adaptations for Web
- Replace OpenCV with WebRTC for camera access
- Use JavaScript QR libraries (qrcode.js, jsQR)
- Implement WebSocket for real-time communication
- Add responsive design for mobile devices
- Include drag-and-drop file interface