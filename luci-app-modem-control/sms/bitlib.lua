--[[
  纯 Lua 位运算工具库
  适配 Lua 5.1（路由器环境无 bit / bit32 库）
  所有运算基于算术实现，32 位无符号语义
]]

local bitlib = {}

-- Lua 5.1 / 5.2+ 兼容
local unpack = table.unpack or unpack

local function norm(n)
	n = math.floor(n)
	if n < 0 then
		n = n + 4294967296 * math.ceil(-n / 4294967296)
	end
	return n % 4294967296
end

function bitlib.band(a, b)
	a, b = norm(a), norm(b)
	local r, p = 0, 1
	for _ = 1, 32 do
		if a % 2 == 1 and b % 2 == 1 then r = r + p end
		a, b, p = math.floor(a / 2), math.floor(b / 2), p * 2
	end
	return r
end

function bitlib.bor(a, b)
	a, b = norm(a), norm(b)
	local r, p = 0, 1
	for _ = 1, 32 do
		if a % 2 == 1 or b % 2 == 1 then r = r + p end
		a, b, p = math.floor(a / 2), math.floor(b / 2), p * 2
	end
	return r
end

function bitlib.bxor(a, b)
	a, b = norm(a), norm(b)
	local r, p = 0, 1
	for _ = 1, 32 do
		if (a % 2) ~= (b % 2) then r = r + p end
		a, b, p = math.floor(a / 2), math.floor(b / 2), p * 2
	end
	return r
end

function bitlib.lshift(a, n)
	return norm(norm(a) * (2 ^ n))
end

function bitlib.rshift(a, n)
	return math.floor(norm(a) / (2 ^ n))
end

function bitlib.bnot(a)
	return 4294967295 - norm(a)
end

-- 从字节序列中按 LSB-first 读取 n 位无符号整数（GSM 7bit 使用此位序）
-- bitpos 为位偏移（0 起），字节内 bit0 为最低位
function bitlib.read_bits_le(bytes, bitpos, nbits)
	local val = 0
	for i = 0, nbits - 1 do
		local bp = bitpos + i
		local byteidx = math.floor(bp / 8) + 1
		local bitidx = bp % 8
		local b = bytes:byte(byteidx) or 0
		local bit = math.floor(b / (2 ^ bitidx)) % 2
		val = val + bit * (2 ^ i)
	end
	return val
end

-- 按 LSB-first 写入 n 位无符号整数（GSM 7bit 使用此位序）
function bitlib.write_bits_le(bytes, bitpos, nbits, value)
	local chars = { bytes:byte(1, #bytes) }
	for i = 0, nbits - 1 do
		local bp = bitpos + i
		local byteidx = math.floor(bp / 8) + 1
		local bitidx = bp % 8
		local bit = math.floor(value / (2 ^ i)) % 2
		local b = chars[byteidx] or 0
		if bit == 1 then
			b = bitlib.bor(b, 2 ^ bitidx)
		else
			b = bitlib.band(b, bitlib.bnot(2 ^ bitidx))
		end
		chars[byteidx] = b
	end
	return string.char(unpack(chars))
end

-- 从大端字节序列中读取 n 位无符号整数（n <= 32）
function bitlib.read_bits_be(bytes, bitpos, nbits)
	local val = 0
	for i = 0, nbits - 1 do
		local bp = bitpos + i
		local byteidx = math.floor(bp / 8) + 1
		local bitidx = 7 - (bp % 8)
		local b = bytes:byte(byteidx) or 0
		local bit = math.floor(b / (2 ^ bitidx)) % 2
		val = val * 2 + bit
	end
	return val
end

-- 写入 n 位无符号整数到大端字节序列
function bitlib.write_bits_be(bytes, bitpos, nbits, value)
	for i = 0, nbits - 1 do
		local bp = bitpos + i
		local byteidx = math.floor(bp / 8) + 1
		local bitidx = 7 - (bp % 8)
		local bit = math.floor(value / (2 ^ (nbits - 1 - i))) % 2
		local b = bytes:byte(byteidx) or 0
		if bit == 1 then
			b = bitlib.bor(b, 2 ^ bitidx)
		else
			b = bitlib.band(b, bitlib.bnot(2 ^ bitidx))
		end
		local prefix = bytes:sub(1, byteidx - 1)
		local suffix = bytes:sub(byteidx + 1)
		bytes = prefix .. string.char(b) .. suffix
	end
	return bytes
end

return bitlib