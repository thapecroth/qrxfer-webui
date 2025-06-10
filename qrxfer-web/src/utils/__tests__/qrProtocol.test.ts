import { describe, it, expect, beforeEach } from 'vitest'
import { QRProtocol } from '../qrProtocol'
import type { TransferChunk } from '../../types/transfer'

describe('QRProtocol', () => {
  let testData: ArrayBuffer
  let testString: string

  beforeEach(() => {
    testString = 'Hello, World! This is a test message for QR transfer.'
    testData = new TextEncoder().encode(testString).buffer
  })

  describe('chunkData', () => {
    it('should split data into chunks of specified size', () => {
      const chunkSize = 10
      const chunks = QRProtocol.chunkData(testData, chunkSize)
      
      expect(chunks).toBeInstanceOf(Array)
      expect(chunks.length).toBeGreaterThan(0)
      
      // Each chunk should be base64 encoded
      chunks.forEach(chunk => {
        expect(typeof chunk).toBe('string')
        // Should be valid base64
        expect(() => atob(chunk)).not.toThrow()
      })
    })

    it('should handle empty data', () => {
      const emptyData = new ArrayBuffer(0)
      const chunks = QRProtocol.chunkData(emptyData, 10)
      expect(chunks).toEqual([])
    })

    it('should handle data smaller than chunk size', () => {
      const smallData = new TextEncoder().encode('Hi').buffer
      const chunks = QRProtocol.chunkData(smallData, 10)
      expect(chunks).toHaveLength(1)
    })
  })

  describe('calculateHash', () => {
    it('should generate consistent SHA-1 hash', async () => {
      const hash1 = await QRProtocol.calculateHash(testData)
      const hash2 = await QRProtocol.calculateHash(testData)
      
      expect(hash1).toBe(hash2)
      expect(hash1).toMatch(/^[a-f0-9]{40}$/) // SHA-1 is 40 hex chars
    })

    it('should generate different hashes for different data', async () => {
      const data2 = new TextEncoder().encode('Different data').buffer
      const hash1 = await QRProtocol.calculateHash(testData)
      const hash2 = await QRProtocol.calculateHash(data2)
      
      expect(hash1).not.toBe(hash2)
    })
  })

  describe('createHeader', () => {
    it('should create valid header messages', () => {
      const length = 5
      const hash = 'abcdef1234567890abcdef1234567890abcdef12'
      const headers = QRProtocol.createHeader(length, hash)
      
      expect(headers).toHaveLength(5)
      expect(headers[0]).toBe(QRProtocol.MESSAGE_BEGIN)
      expect(headers[1]).toBe(QRProtocol.HEADER_BEGIN)
      expect(headers[2]).toBe(`LEN:${length}`)
      expect(headers[3]).toBe(`HASH:${hash}`)
      expect(headers[4]).toBe(QRProtocol.HEADER_END)
    })
  })

  describe('createDataMessage', () => {
    it('should format data message correctly', () => {
      const sequence = 42
      const data = 'dGVzdCBkYXRh' // base64 for "test data"
      const message = QRProtocol.createDataMessage(sequence, data)
      
      expect(message).toBe('0000000042:dGVzdCBkYXRh')
    })

    it('should pad sequence numbers correctly', () => {
      const message1 = QRProtocol.createDataMessage(1, 'data')
      const message2 = QRProtocol.createDataMessage(1000, 'data')
      
      expect(message1).toBe('0000000001:data')
      expect(message2).toBe('0000001000:data')
    })
  })

  describe('parseMessage', () => {
    it('should parse header messages correctly', () => {
      const beginMsg = QRProtocol.parseMessage(QRProtocol.MESSAGE_BEGIN)
      const endMsg = QRProtocol.parseMessage(QRProtocol.MESSAGE_END)
      const headerBeginMsg = QRProtocol.parseMessage(QRProtocol.HEADER_BEGIN)
      const lenMsg = QRProtocol.parseMessage('LEN:10')
      const hashMsg = QRProtocol.parseMessage('HASH:abcdef123')
      
      expect(beginMsg?.type).toBe('header')
      expect(endMsg?.type).toBe('end')
      expect(headerBeginMsg?.type).toBe('header')
      expect(lenMsg?.type).toBe('header')
      expect(hashMsg?.type).toBe('header')
    })

    it('should parse chunk messages correctly', () => {
      const chunkMsg = QRProtocol.parseMessage('0000000042:dGVzdCBkYXRh')
      expect(chunkMsg?.type).toBe('chunk')
      expect(chunkMsg?.content).toBe('0000000042:dGVzdCBkYXRh')
    })

    it('should return null for invalid messages', () => {
      const invalidMsg = QRProtocol.parseMessage('invalid message')
      expect(invalidMsg).toBeNull()
    })
  })

  describe('parseDataChunk', () => {
    it('should parse valid chunk data', () => {
      const chunkString = '0000000042:dGVzdCBkYXRh'
      const chunk = QRProtocol.parseDataChunk(chunkString)
      
      expect(chunk).toEqual({
        sequence: 42,
        data: 'dGVzdCBkYXRh'
      })
    })

    it('should return null for invalid chunk format', () => {
      const invalidChunk = QRProtocol.parseDataChunk('invalid:format')
      expect(invalidChunk).toBeNull()
    })
  })

  describe('parseHeader', () => {
    it('should parse header messages correctly', () => {
      const headerMessages = [
        'LEN:10',
        'HASH:abcdef1234567890abcdef1234567890abcdef12'
      ]
      const header = QRProtocol.parseHeader(headerMessages)
      
      expect(header).toEqual({
        length: 10,
        hash: 'abcdef1234567890abcdef1234567890abcdef12'
      })
    })

    it('should return null for incomplete header', () => {
      const incompleteHeader = ['LEN:10']
      const header = QRProtocol.parseHeader(incompleteHeader)
      
      expect(header).toBeNull()
    })
  })

  describe('reconstructData', () => {
    it('should reconstruct data from chunks correctly', () => {
      // Create test chunks
      const originalData = 'Hello, World!'
      const encodedData = btoa(originalData)
      
      const chunks: TransferChunk[] = [
        { sequence: 0, data: encodedData }
      ]
      
      const reconstructed = QRProtocol.reconstructData(chunks)
      const reconstructedString = new TextDecoder().decode(reconstructed)
      
      expect(reconstructedString).toBe(originalData)
    })

    it('should handle multiple chunks in correct order', () => {
      const part1 = btoa('Hello, ')
      const part2 = btoa('World!')
      
      const chunks: TransferChunk[] = [
        { sequence: 1, data: part2 }, // Out of order
        { sequence: 0, data: part1 }
      ]
      
      const reconstructed = QRProtocol.reconstructData(chunks)
      const reconstructedString = new TextDecoder().decode(reconstructed)
      
      expect(reconstructedString).toBe('Hello, World!')
    })
  })

  describe('verifyIntegrity', () => {
    it('should verify data integrity correctly', async () => {
      const hash = await QRProtocol.calculateHash(testData)
      const isValid = await QRProtocol.verifyIntegrity(testData, hash)
      
      expect(isValid).toBe(true)
    })

    it('should reject tampered data', async () => {
      const hash = await QRProtocol.calculateHash(testData)
      const wrongData = new TextEncoder().encode('Wrong data').buffer
      const isValid = await QRProtocol.verifyIntegrity(wrongData, hash)
      
      expect(isValid).toBe(false)
    })

    it('should reject wrong hash', async () => {
      const wrongHash = 'wrong hash that is not correct at all here'
      const isValid = await QRProtocol.verifyIntegrity(testData, wrongHash)
      
      expect(isValid).toBe(false)
    })
  })

  describe('full transfer simulation', () => {
    it('should complete a full transfer cycle', async () => {
      const originalText = 'This is a complete test of the QR transfer protocol!'
      const originalData = new TextEncoder().encode(originalText).buffer
      const chunkSize = 10
      
      // Step 1: Create chunks and hash (sender side)
      const chunks = QRProtocol.chunkData(originalData, chunkSize)
      const hash = await QRProtocol.calculateHash(originalData)
      const headers = QRProtocol.createHeader(chunks.length, hash)
      
      // Step 2: Create data messages
      const dataMessages = chunks.map((chunk, index) => 
        QRProtocol.createDataMessage(index, chunk)
      )
      
      // Step 3: Simulate receiver processing
      const receivedChunks: TransferChunk[] = []
      
      // Process header
      const headerMessages = headers.slice(2, 4) // Extract LEN: and HASH: messages
      const parsedHeader = QRProtocol.parseHeader(headerMessages)
      expect(parsedHeader).not.toBeNull()
      expect(parsedHeader?.length).toBe(chunks.length)
      expect(parsedHeader?.hash).toBe(hash)
      
      // Process data messages
      for (const message of dataMessages) {
        const chunk = QRProtocol.parseDataChunk(message)
        if (chunk) {
          receivedChunks.push(chunk)
        }
      }
      
      // Step 4: Reconstruct and verify
      const reconstructedData = QRProtocol.reconstructData(receivedChunks)
      const isValid = await QRProtocol.verifyIntegrity(reconstructedData, hash)
      const reconstructedText = new TextDecoder().decode(reconstructedData)
      
      expect(isValid).toBe(true)
      expect(reconstructedText).toBe(originalText)
      expect(receivedChunks).toHaveLength(chunks.length)
    })
  })
})