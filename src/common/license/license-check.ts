import * as fs from 'fs';
import * as crypto from 'crypto';
import * as child_process from 'child_process';
import * as path from 'path';

const LICENSE_PATH = path.resolve(process.cwd(), 'license.lic');
const AES_KEY = Buffer.from('G7@vL#9t!pZ2Q$ABw&kJ4^rM8bY?esN1', 'utf-8'); // 32字节

/**
 * 获取机器唯一指纹（CPU + 硬盘 + 主板）
 * 与 BAT 输出一致，保证 Node.js 与 Python license 校验一致
 */
export function getMachineFingerprint(): string {
  const getValue = (cmd: string, key?: string): string => {
    try {
      const output = child_process.execSync(cmd, { encoding: 'utf-8' }).toString();
      // 如果是 key=value 格式，直接取等号右边
      if (key && output.includes('=')) {
        const line = output
          .split('\n')
          .map(l => l.trim())
          .filter(l => l && l.includes('='))
          .map(l => l.split('=')[1].trim())[0];
        return line || '';
      }
      // 否则过滤空行和列名
      const line = output
        .split('\n')
        .map(l => l.trim())
        .filter(l => l && !/SerialNumber|ProcessorId/i.test(l))[0];
      return line || '';
    } catch {
      return '';
    }
  };

  // ======== 获取硬件信息 ========
  const cpu = getValue('wmic cpu get ProcessorId', 'ProcessorId');
  const disk = getValue('wmic diskdrive where "Index=0" get SerialNumber /value', 'SerialNumber');
  const board = getValue('wmic baseboard get SerialNumber', 'SerialNumber');

  // 去掉所有空格
  const raw = `${cpu}-${disk}-${board}`.replace(/\s+/g, '');

  console.log('🧩 Node.js 获取硬件信息：');
  console.log('CPU   :', cpu);
  console.log('Disk  :', disk);
  console.log('Board :', board);
  console.log('Raw   :', raw);

  // 返回 SHA256 指纹
  return crypto.createHash('sha256').update(raw).digest('hex');
}


function loadLicense(filename = LICENSE_PATH): Record<string, any> {
  if (!fs.existsSync(filename)) {
    console.error(`❌ License 文件不存在: ${filename}`);
    process.exit(1);
  }

  const fileData = fs.readFileSync(filename);
  const iv = fileData.slice(0, 16);
  const ciphertext = fileData.slice(16);

  try {
    const decipher = crypto.createDecipheriv('aes-256-cbc', AES_KEY, iv);
    decipher.setAutoPadding(true);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return JSON.parse(decrypted.toString('utf-8').trim());
  } catch (err) {
    console.error('❌ License 文件解密失败:', (err as Error).message);
    process.exit(1);
  }
}

export function verifyLicense(): void {
  const license = loadLicense();
  const localFingerprint = getMachineFingerprint();

  if (license.fingerprint !== localFingerprint) {
    console.error('❌ License 校验失败：非授权机器');
    console.error(`license: ${license.fingerprint}`);
    console.error(`local  : ${localFingerprint}`);
    process.exit(1);
  }

  const expire = new Date(license.expire);
  if (isNaN(expire.getTime())) {
    console.error('❌ License 文件格式错误：过期日期无效');
    process.exit(1);
  }

  if (new Date() > expire) {
    console.error(`❌ License 校验失败：已于 ${license.expire} 过期`);
    process.exit(1);
  }

  console.log(`✅ License 校验通过，有效期至：${license.expire}`);
}
