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
import { deflate } from 'fflate';

// File transfer state management
// 文件传输状态管理
window.fileTransfers = new Map();

// Generate unique file ID
// 生成唯一文件ID
function generateFileId() {
	return 'file_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Compress file into volumes
// 将文件压缩为分卷
async function compressFileToVolumes(file, volumeSize = 128 * 1024) {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = function(e) {
			const arrayBuffer = new Uint8Array(e.target.result);
			
			// Compress the file data
			deflate(arrayBuffer, { level: 6 }, (err, compressed) => {
				if (err) {
					reject(err);
					return;
				}
						// Split into volumes
				const volumes = [];
				for (let i = 0; i < compressed.length; i += volumeSize) {
					const volume = compressed.slice(i, i + volumeSize);
					// Convert to base64 without using spread operator to avoid stack overflow
					let binaryString = '';
					for (let j = 0; j < volume.length; j++) {
						binaryString += String.fromCharCode(volume[j]);
					}
					volumes.push(btoa(binaryString));
				}
				
				resolve({
					volumes,
					originalSize: file.size,
					compressedSize: compressed.length
				});
			});
		};
		reader.onerror = () => reject(reader.error);
		reader.readAsArrayBuffer(file);
	});
}

// Decompress volumes back to file
// 将分卷解压回文件
async function decompressVolumesToFile(volumes, fileName) {	try {
		// Combine all volumes
		const combinedData = volumes.map(volume => {
			const binaryString = atob(volume);
			const bytes = new Uint8Array(binaryString.length);
			for (let i = 0; i < binaryString.length; i++) {
				bytes[i] = binaryString.charCodeAt(i);
			}
			return bytes;
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
			import('fflate').then(({ inflate }) => {
				inflate(compressed, (err, decompressed) => {
					if (err) {
						reject(err);
						return;
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
				const fileId = generateFileId();
				
				try {
					// 显示压缩进度
					window.addSystemMsg(`Compressing ${file.name}...`);
					
					// 压缩文件为分卷
					const { volumes, originalSize, compressedSize } = await compressFileToVolumes(file);
					
					// 创建文件传输状态
					const fileTransfer = {
						fileId,
						fileName: file.name,
						originalSize,
						compressedSize,
						totalVolumes: volumes.length,
						sentVolumes: 0,
						status: 'sending'
					};
					
					window.fileTransfers.set(fileId, fileTransfer);
					
					// 发送文件开始消息
					onSend({
						type: 'file_start',
						fileId,
						fileName: file.name,
						originalSize,
						compressedSize,
						totalVolumes: volumes.length
					});
					
					// 逐个发送分卷
					for (let i = 0; i < volumes.length; i++) {
						onSend({
							type: 'file_volume',
							fileId,
							volumeIndex: i,
							volumeData: volumes[i],
							isLast: i === volumes.length - 1
						});
						
						// 更新发送进度
						fileTransfer.sentVolumes = i + 1;
						updateFileProgress(fileId);
						
						// 添加小延迟避免消息过快
						await new Promise(resolve => setTimeout(resolve, 50));
					}
					
					// 发送完成消息
					onSend({
						type: 'file_complete',
						fileId
					});
					
					fileTransfer.status = 'completed';
					updateFileProgress(fileId);
					
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
		
		if (transfer.status === 'sending') {
			const progress = (transfer.sentVolumes / transfer.totalVolumes) * 100;
			if (progressBar) progressBar.style.width = `${progress}%`;
			if (statusText) statusText.textContent = `Sending ${transfer.sentVolumes}/${transfer.totalVolumes}`;
		} else if (transfer.status === 'receiving') {
			const progress = (transfer.receivedVolumes.size / transfer.totalVolumes) * 100;
			if (progressBar) progressBar.style.width = `${progress}%`;
			if (statusText) statusText.textContent = `Receiving ${transfer.receivedVolumes.size}/${transfer.totalVolumes}`;
		} else if (transfer.status === 'completed') {
			if (progressBar) progressBar.style.width = '100%';
			if (statusText) statusText.textContent = '✓ Completed';
			if (downloadBtn) {
				downloadBtn.style.display = 'inline-block';
				downloadBtn.disabled = false;
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
	const { fileId, fileName, originalSize, compressedSize, totalVolumes } = message;
	
	const fileTransfer = {
		fileId,
		fileName,
		originalSize,
		compressedSize,
		totalVolumes,
		receivedVolumes: new Set(),
		volumeData: new Array(totalVolumes),
		status: 'receiving'
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
		await decompressVolumesToFile(transfer.volumeData, transfer.fileName);
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