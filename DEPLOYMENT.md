# คู่มือการติดตั้งและ Deploy (ฉบับเริ่มจากศูนย์)

เนื่องจากคุณพบปัญหาว่าไม่รู้จักคำสั่ง `docker-compose` แสดงว่าเครื่องของคุณยังไม่ได้ติดตั้งโปรแกรม Docker ครับ
คู่มือนี้จะพาทำตั้งแต่ **ขั้นตอนที่ 1** คือการลงโปรแกรมที่จำเป็น ไปจนถึงเปิดใช้งานเว็บไซต์และบอทได้ครับ

---

## ขั้นตอนที่ 1: ติดตั้ง Docker Desktop (สำหรับ Windows)

Docker เป็นโปรแกรมจำลองสภาพแวดล้อม (Container) ที่ช่วยให้เรารัน Web และ Bot ได้ง่ายๆ โดยไม่ต้องตั้งค่าอะไรเยอะในเครื่องจริง

1.  **ดาวน์โหลด**:
    - ไปที่เว็บไซต์ [Docker Desktop for Windows](https://docs.docker.com/desktop/install/windows-install/)
    - คลิกปุ่ม **"Docker Desktop for Windows"** เพื่อดาวน์โหลดตัวติดตั้ง

2.  **ติดตั้ง**:
    - เปิดไฟล์ `.exe` ที่ดาวน์โหลดมา
    - ทำตามขั้นตอนการติดตั้ง (กด Next/Ok ไปเรื่อยๆ)
    - **สำคัญ**: ระหว่างติดตั้ง ถ้ามีการถามให้เปิดใช้ **WSL 2** (Windows Subsystem for Linux) ให้ติ๊กถูกเลือกด้วย (แนะนำอย่างยิ่ง)
    - เมื่อติดตั้งเสร็จ **ต้อง Restart เครื่องคอมพิวเตอร์ 1 รอบ**

3.  **เปิดโปรแกรม**:
    - หลัง Restart ให้เปิดโปรแกรม **Docker Desktop** ขึ้นมา
    - รอจนกว่าสถานะที่มุมล่างซ้ายของโปรแกรมจะเป็นสีเขียว (Engine running)
    - ถ้ามีการถามยอมรับเงื่อนไข (Accept Terms) ให้กด Accept
    - *หมายเหตุ: ถ้าหน้าต่าง Docker แจ้งเตือนเรื่อง WSL Kernel ให้กดลิงก์ในนั้นเพื่อโหลดตัวอัพเดทมาลงตามที่โปรแกรมแนะนำ*

4.  **ตรวจสอบว่าใช้ได้หรือยัง**:
    - เปิด Terminal (PowerShell หรือ cmd) ใน VS Code
    - พิมพ์คำสั่ง:
      ```powershell
      docker --version
      ```
    - ถ้าขึ้นเลขเวอร์ชัน (เช่น `Docker version 24.0.0...`) แปลว่าผ่าน! พร้อมไปขั้นตอนต่อไป

---

## ขั้นตอนที่ 2: เตรียมไฟล์ Project

1.  **สร้างไฟล์ .env**:
    - ในโปรเจกต์ของคุณตอนนี้มีไฟล์ `.env.example` อยู่ครับ ให้ copy มาเป็น `.env`
    - (ถ้าคุณมีไฟล์ `.env` ที่ใช้ตอน dev อยู่แล้ว ก็ข้ามขั้นตอนนี้ได้เลย แต่ต้องแน่ใจว่าใส่ค่าครบถ้วนแล้ว)
    - ถ้า `.env` ในเครื่องใช้ `NEXTAUTH_URL` เป็นโดเมน production อยู่ ไม่ต้องแก้เพื่อรัน Docker local เพราะ `docker compose` ของโปรเจกต์จะ override เป็น `http://localhost:3000` ให้เอง
    - ถ้าต้องการ override เองสำหรับ local Docker ให้ตั้ง `LOCAL_NEXTAUTH_URL=http://localhost:3000`

2.  **ตรวจสอบ Database**:
    - Production path ของโปรเจกต์นี้ใช้ **Turso เท่านั้น**
    - ต้องตั้งค่า `TURSO_DATABASE_URL` และ `TURSO_AUTH_TOKEN` ใน `.env` ให้ครบ
    - ก่อน deploy ให้รัน `npm run validate:env:prod` เพื่อเช็ก env ที่จำเป็นทั้งหมด

---

## ขั้นตอนที่ 3: เริ่มรันโปรแกรม (Deploy)

เมื่อติดตั้ง Docker เสร็จและเปิดโปรแกรม Docker Desktop ค้างไว้แล้ว ให้ทำดังนี้:

1.  **รันคำสั่ง**:
    พิมพ์คำสั่งตรวจสอบก่อนปล่อยจริง:
    ```powershell
    npm run release:verify
    ```
    จากนั้น apply schema ล่าสุดขึ้น Turso:
    ```powershell
    npm run db:push
    ```
    แล้วจึงค่อยรันระบบ:
    พิมพ์คำสั่งนี้ใน Terminal ของ VS Code:
    ```powershell
    docker compose up --build -d
    ```
    - `up`: เริ่มทำงาน
    - `--build`: สร้าง image ใหม่ (เผื่อมีการแก้โค้ด)
    - `-d`: Detached mode (รันเบื้องหลัง ไม่ต้องเปิดหน้าต่างค้างไว้)

2.  **รอสักครู่**:
    - ครั้งแรกจะนานหน่อย เพราะต้องโหลด setup ต่างๆ
    - รอจนมันขึ้น `Started` ครบทั้ง `web` และ `bot`

---

## ขั้นตอนที่ 4: ใช้งาน

1.  **เว็บไซต์**:
    - เปิด Browser ไปที่ [http://localhost:3000](http://localhost:3000)
    - คุณควรจะเห็นหน้าเว็บขึ้นมา
    - ตรวจสอบ health endpoint ที่ [http://localhost:3000/api/health](http://localhost:3000/api/health)
    - ทดสอบ Discord login บน localhost และยืนยันว่า auth flow ไม่เด้งกลับไป production host

2.  **บอท Discord**:
    - ไปดูใน Discord ว่าบอทออนไลน์ขึ้นมาหรือยัง
    - ตรวจสอบ manager probes ที่ `http://localhost:8080/health` และ `http://localhost:8080/ready`
    - ปุ่ม Dashboard ที่ bot สร้างใน local ควรพาไป `http://localhost:3000` ไม่ใช่ host production

---

## การปิด/หยุดทำงาน

ถ้าต้องการปิดเซิร์ฟเวอร์ ให้พิมพ์คำสั่ง:
```powershell
docker compose down
```

---

## ภาคผนวก: การนำขึ้น Server จริง (Production Deployment)

หากคุณต้องการเปิดให้คนอื่นใช้งาน คุณต้องเช่าเครื่อง Server (VPS) และนำโปรเจกต์ไปรันบนนั้นครับ
แนะนำให้เช่า VPS ที่เป็น **Ubuntu 22.04 LTS** หรือใหม่กว่า

### 1. เช่าและเข้าใช้งาน Server
คุณสามารถเช่าจากผู้ให้บริการเช่น DigitalOcean, Vultr, Linode, หรือ Cloud ในไทย
เมื่อเช่าเสร็จ คุณจะได้ **IP Address**, **Username** (ปกติคือ `root`), และ **Password**

### 2. ติดตั้ง Docker บน Server (Ubuntu)
รันคำสั่งเหล่านี้ทีละบรรทัดใน Terminal ของ Server:

```bash
# อัพเดทระบบ
sudo apt update
sudo apt install -y ca-certificates curl gnupg

# ติดตั้ง Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# ตรวจสอบว่าติดตั้งสำเร็จ
docker --version
docker compose version
```

### 3. นำโค้ดขึ้น Server
วิธีที่ง่ายที่สุดคือใช้ **Git** (Upload ขึ้น GitHub/GitLab ก่อน) แล้ว Clone ลงมา

```bash
# ติดตั้ง Git (ถ้ายังไม่มี)
sudo apt install -y git

# ดึงโปรเจกต์ลงมา (เปลี่ยน URL เป็นของคุณ)
git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git
cd YOUR_REPO
```

*(หรือถ้าไม่ได้ใช้ Git สามารถใช้โปรแกรม FileZilla อัพโหลดไฟล์ทั้งหมดยกเว้น `node_modules` ขึ้นไปได้)*

### 4. ตั้งค่าและรัน
```bash
# สร้างไฟล์ .env
cp .env.example .env
nano .env  # แก้ไขค่าต่างๆ ในนี้ให้ถูกต้อง (กด Ctrl+X, Y, Enter เพื่อบันทึก)

# ตรวจสอบ env + test + build ก่อน deploy
npm run release:verify

# Apply schema ล่าสุดขึ้น Turso
npm run db:push

# รัน Docker
docker compose up --build -d
```

### 5. เรียบร้อย!
ตอนนี้เว็บของคุณจะออนไลน์ที่ `http://YOUR_SERVER_IP:3000`
และบอท Discord ก็จะทำงานออนไลน์ครับ
โดยควรตรวจสอบเพิ่มทันทีว่า:

- `http://YOUR_SERVER_IP:3000/api/health` ตอบ `status: ok`
- `http://YOUR_BOT_HOST/health` ตอบได้
- `http://YOUR_BOT_HOST/ready` ตอบ `status: ready`
