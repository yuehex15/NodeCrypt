// Import necessary modules
// 导入必要的模块
import {
	$,
	$id,
	createElement,
	on,
	addClass,
	removeClass
} from './util.dom.js';
import { deflate, inflate } from 'fflate';

// File transfer state management
// 文件传输状态管理
window.fileTransfers = new Map();

// Base64 encoding for binary data (more efficient than hex)
// Base64编码用于二进制数据（比十六进制更高效）
function arrayBufferToBase64(buffer) {
	const uint8Array = new Uint8Array(buffer);
	let binary = '';
	const chunkSize = 0x8000; // 32KB chunks to avoid call stack limits
	
	for (let i = 0; i < uint8Array.length; i += chunkSize) {
		const chunk = uint8Array.subarray(i, i + chunkSize);
		binary += String.fromCharCode.apply(null, chunk);
	}
	
	return btoa(binary);
}

// Base64 decoding back to binary
// Base64解码回二进制数据
function base64ToArrayBuffer(base64) {
	const binary = atob(base64);
	const uint8Array = new Uint8Array(binary.length);
	
	for (let i = 0; i < binary.length; i++) {
		uint8Array[i] = binary.charCodeAt(i);
	}
	
	return uint8Array;
}

// Generate unique file ID
// 生成唯一文件ID
function generateFileId() {
	return 'file_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Calculate SHA-256 hash for data integrity verification
// 计算SHA-256哈希值用于数据完整性验证
async function calculateHash(data) {
	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Compress file into volumes with optimized compression
// 将文件压缩为分卷，优化压缩算法
async function compressFileToVolumes(file, volumeSize = 96 * 1024) { // 96KB原始数据，base64后约128KB
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = async function(e) {
			const arrayBuffer = new Uint8Array(e.target.result);
			
			try {
				// Calculate hash of original file for integrity
				const originalHash = await calculateHash(arrayBuffer);
				
				// Use single compression pass with balanced compression
				// 使用单次压缩，平衡压缩率和速度
				deflate(arrayBuffer, { 
					level: 6, // 平衡压缩级别
					mem: 8    // 合理内存使用
				}, (err, compressed) => {
					if (err) {
						reject(err);
						return;
					}
					
					// Split compressed data into volumes
					const volumes = [];
					for (let i = 0; i < compressed.length; i += volumeSize) {
						const volume = compressed.slice(i, i + volumeSize);
						volumes.push(arrayBufferToBase64(volume));
					}
					
					resolve({
						volumes,
						originalSize: file.size,
						compressedSize: compressed.length,
						originalHash
					});
				});
			} catch (hashError) {
				reject(hashError);
			}
		};
		reader.onerror = () => reject(reader.error);
		reader.readAsArrayBuffer(file);
	});
}

// Decompress volumes back to file
// 将分卷解压回文件
async function decompressVolumesToFile(volumes, fileName, originalHash = null) {
	try {
		// Combine all volumes using base64 decoding
		const combinedData = volumes.map(volume => {
			return base64ToArrayBuffer(volume);
		});
		
		const totalLength = combinedData.reduce((sum, arr) => sum + arr.length, 0);
		const compressed = new Uint8Array(totalLength);
		let offset = 0;
		
		for (const data of combinedData) {
			compressed.set(data, offset);
			offset += data.length;
		}
				// Decompress
		return new Promise((resolve, reject) => {
			inflate(compressed, async (err, decompressed) => {
				if (err) {
					reject(err);
					return;
				}
				
				// Verify hash if provided
				if (originalHash) {
					try {
						const calculatedHash = await calculateHash(decompressed);
						if (calculatedHash !== originalHash) {
							reject(new Error('File integrity check failed: hash mismatch'));
							return;
						}
					} catch (hashError) {
						reject(new Error('File integrity check failed: ' + hashError.message));
						return;
					}
				}
				
				// Create blob and download
				const blob = new Blob([decompressed]);
				const url = URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url;
				a.download = fileName;
				document.body.appendChild(a);
				a.click();
				document.body.removeChild(a);
				URL.revokeObjectURL(url);
				
				resolve();
			});
		});
	} catch (error) {
		console.error('Decompression error:', error);
		throw error;
	}
}

// Setup file sending functionality
// 设置文件发送功能
export function setupFileSend({
	inputSelector,
	attachBtnSelector,
	fileInputSelector,
	onSend
}) {
	const attachBtn = document.querySelector(attachBtnSelector);
	const fileInput = document.querySelector(fileInputSelector);
	
	if (attachBtn && fileInput) {
		// 移除文件类型限制，接受所有文件
		// Remove file type restriction, accept all files
		fileInput.accept = '*/*';
		
		// 点击附件按钮触发文件选择
		// Click attach button to trigger file selection
		attachBtn.addEventListener('click', (e) => {
			e.preventDefault();
			e.stopPropagation();
			fileInput.click();
		});
		
		// 处理文件选择
		// Handle file selection
		fileInput.addEventListener('change', async (e) => {
			const files = e.target.files;
			if (files && files.length > 0) {
				const file = files[0];
				const fileId = generateFileId();				try {
					// 显示压缩进度
					let progressElement = null;
					
					// 创建一个简单的进度显示函数
					function showProgress(message) {
						if (window.addSystemMsg) {
							progressElement = window.addSystemMsg(message);
						}
					}
					
					function updateProgress(message) {
						if (progressElement && progressElement.querySelector) {
							const content = progressElement.querySelector('.bubble-content');
							if (content) {
								content.innerHTML = message;
							}
						}
					}
					
					showProgress(`Compressing ${file.name}...`);
							// 使用 Web Worker 进行压缩以避免阻塞主线程
					const { volumes, originalSize, compressedSize, originalHash } = await compressFileToVolumes(file);
					
					updateProgress(`✓ Compressed ${file.name} (${volumes.length} volumes, ${formatFileSize(compressedSize)})`);
					
					// 创建文件传输状态
					const fileTransfer = {
						fileId,
						fileName: file.name,
						originalSize,
						compressedSize,
						totalVolumes: volumes.length,
						sentVolumes: 0,
						status: 'sending',
						originalHash
					};
					
					window.fileTransfers.set(fileId, fileTransfer);
					
					// 发送文件开始消息
					onSend({
						type: 'file_start',
						fileId,
						fileName: file.name,
						originalSize,
						compressedSize,
						totalVolumes: volumes.length,
						originalHash
					});
					
					// 使用批量发送来提高效率，避免页面切换时中断
					let currentVolume = 0;
					const batchSize = 5; // 每批发送5个分卷
					
					function sendNextBatch() {
						if (currentVolume >= volumes.length) {
							// 发送完成消息
							onSend({
								type: 'file_complete',
								fileId
							});
							
							fileTransfer.status = 'completed';
							updateFileProgress(fileId);
							updateProgress(`✓ Sent ${file.name} successfully`);
							return;
						}
						
						// 发送当前批次
						const batchEnd = Math.min(currentVolume + batchSize, volumes.length);
						const batch = [];
						
						for (let i = currentVolume; i < batchEnd; i++) {
							batch.push({
								type: 'file_volume',
								fileId,
								volumeIndex: i,
								volumeData: volumes[i],
								isLast: i === volumes.length - 1
							});
						}
						
						// 发送批次中的所有分卷
						batch.forEach(volumeMsg => onSend(volumeMsg));
						
						// 更新发送进度
						fileTransfer.sentVolumes = batchEnd;
						updateFileProgress(fileId);
						
						currentVolume = batchEnd;
						
						// 继续发送下一批，使用较短的延迟
						setTimeout(sendNextBatch, 100);
					}
					
					// 开始发送
					sendNextBatch();
					
				} catch (error) {
					console.error('File compression error:', error);
					window.addSystemMsg(`Failed to compress ${file.name}: ${error.message}`);
				}
			}
			
			// 清空文件输入
			e.target.value = '';
		});
	}
}

// Update file progress in chat
// 更新聊天中的文件进度
function updateFileProgress(fileId) {
	const transfer = window.fileTransfers.get(fileId);
	if (!transfer) return;
	
	const elements = document.querySelectorAll(`[data-file-id="${fileId}"]`);
	elements.forEach(element => {
		const progressBar = element.querySelector('.file-progress');
		const statusText = element.querySelector('.file-status');
		const downloadBtn = element.querySelector('.file-download-btn');
		
		// 判断是否为发送方（发送方没有volumeData）
		const isSender = !transfer.volumeData || transfer.volumeData.length === 0;
		
		if (transfer.status === 'sending') {
			const progress = (transfer.sentVolumes / transfer.totalVolumes) * 100;
			if (progressBar) progressBar.style.width = `${progress}%`;
			if (statusText) statusText.textContent = `Sending ${transfer.sentVolumes}/${transfer.totalVolumes}`;
			if (downloadBtn) downloadBtn.style.display = 'none';
		} else if (transfer.status === 'receiving') {
			const progress = (transfer.receivedVolumes.size / transfer.totalVolumes) * 100;
			if (progressBar) progressBar.style.width = `${progress}%`;
			if (statusText) statusText.textContent = `Receiving ${transfer.receivedVolumes.size}/${transfer.totalVolumes}`;
			if (downloadBtn) downloadBtn.style.display = 'none';
		} else if (transfer.status === 'completed') {
			if (progressBar) progressBar.style.width = '100%';
			if (statusText) statusText.textContent = '✓ Completed';
			if (downloadBtn) {
				// 只有接收方才显示下载按钮
				if (isSender) {
					downloadBtn.style.display = 'none';
				} else {
					downloadBtn.style.display = 'inline-block';
					downloadBtn.disabled = false;
				}
			}
		}
	});
}

// Handle incoming file messages
// 处理接收到的文件消息
export function handleFileMessage(message, isPrivate = false) {
	const { type, fileId } = message;
	
	switch (type) {
		case 'file_start':
			handleFileStart(message, isPrivate);
			break;
		case 'file_volume':
			handleFileVolume(message);
			break;
		case 'file_complete':
			handleFileComplete(message);
			break;
	}
}

// Handle file start message
// 处理文件开始消息
function handleFileStart(message, isPrivate) {
	const { fileId, fileName, originalSize, compressedSize, totalVolumes, originalHash } = message;
	
	const fileTransfer = {
		fileId,
		fileName,
		originalSize,
		compressedSize,
		totalVolumes,
		receivedVolumes: new Set(),
		volumeData: new Array(totalVolumes),
		status: 'receiving',
		originalHash
	};
	
	window.fileTransfers.set(fileId, fileTransfer);
	
	// 添加文件消息到聊天
	if (window.addOtherMsg) {
		window.addOtherMsg({
			type: 'file',
			fileId,
			fileName,
			originalSize,
			totalVolumes
		}, '', '', false, isPrivate ? 'file_private' : 'file');
	}
}

// Handle file volume message
// 处理文件分卷消息
function handleFileVolume(message) {
	const { fileId, volumeIndex, volumeData } = message;
	const transfer = window.fileTransfers.get(fileId);
	
	if (!transfer) return;
	
	transfer.receivedVolumes.add(volumeIndex);
	transfer.volumeData[volumeIndex] = volumeData;
	
	updateFileProgress(fileId);
}

// Handle file complete message
// 处理文件完成消息
function handleFileComplete(message) {
	const { fileId } = message;
	const transfer = window.fileTransfers.get(fileId);
	
	if (!transfer) return;
	
	// 检查是否所有分卷都已接收
	if (transfer.receivedVolumes.size === transfer.totalVolumes) {
		transfer.status = 'completed';
		updateFileProgress(fileId);
	}
}

// Download file from volumes
// 从分卷下载文件
export async function downloadFile(fileId) {
	const transfer = window.fileTransfers.get(fileId);
	if (!transfer || transfer.status !== 'completed') return;
	
	try {
		await decompressVolumesToFile(transfer.volumeData, transfer.fileName, transfer.originalHash);
		window.addSystemMsg(`Downloaded ${transfer.fileName}`);
	} catch (error) {
		console.error('Download error:', error);
		window.addSystemMsg(`Failed to download ${transfer.fileName}: ${error.message}`);
	}
}

// Format file size
// 格式化文件大小
export function formatFileSize(bytes) {
	if (bytes === 0) return '0 Bytes';
	const k = 1024;
	const sizes = ['Bytes', 'KB', 'MB', 'GB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Legacy image send function for backward compatibility
// 向后兼容的图片发送函数
export function setupImageSend(config) {
	setupFileSend(config);
}