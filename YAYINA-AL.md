# Siteyi yayına alma — Render

Toplam süre: yaklaşık 10 dakika. Terminal komutu yok, hepsi tarayıcıdan.

> **Neden Netlify değil?**
> Netlify statik dosya sunar; sürekli çalışan bir program çalıştırmaz.
> Senin siten bir Node.js sunucusu ve SQLite veritabanı üzerinde çalışıyor —
> admin panelinden yaptığın her değişiklik veritabanına yazılıyor.
> Netlify'da sunucu duramayacağı için admin paneli çalışmaz ve
> değişikliklerin kaybolurdu. Render tam olarak bunun için var.

---

## 1. GitHub'a yükle (5 dakika)

Render kodu bir GitHub deposundan alıyor. Git komutu bilmene gerek yok —
dosyaları tarayıcıya sürükleyeceksin.

1. <https://github.com/signup> → hesap aç (varsa giriş yap)
2. Sağ üstteki **+** → **New repository**
3. **Repository name:** `portfolio`
4. **Public** seçili kalsın · **"Add a README file" kutusunu İŞARETLEME**
5. **Create repository**
6. Açılan sayfada **"uploading an existing file"** bağlantısına tıkla
7. `YAYINA-HAZIR` klasörünün **içindeki her şeyi** seç (klasörün kendisini değil)
   ve tarayıcı penceresine sürükle
8. Yükleme bitince aşağıdaki yeşil **Commit changes** düğmesine bas

> `data` klasörünü ve `.env` dosyasını yükleme. `YAYINA-HAZIR` klasöründe
> zaten yoklar — şifre hash'in ve oturum anahtarın orada duruyordu.

---

## 2. Render'a bağla (4 dakika)

1. <https://render.com> → **Get Started** → **GitHub ile giriş yap**
2. **New +** → **Blueprint**
3. Az önce oluşturduğun `portfolio` deposunu seç → **Connect**
4. Render `render.yaml` dosyasını okuyup her şeyi kendi ayarlar:
   sunucu, 1 GB kalıcı disk, ortam değişkenleri
5. **Apply** / **Create** düğmesine bas
6. İlk kurulum 2–3 dakika sürer

Bitince adresin şöyle olur:

```
https://read-alallos-portfolio.onrender.com
```

---

## 3. Şifreni öğren

Render kurulum sırasında sana rastgele güçlü bir şifre üretti.

**Dashboard → servisin → sol menüden Environment**

- `ADMIN_USERNAME` → `read`
- `ADMIN_PASSWORD` → göz simgesine bas, göründü

Bu şifreyle `https://siten.onrender.com/admin` adresine gir.
Beğenmezsen aynı ekrandan değiştirebilirsin (değiştirince servis yeniden başlar).

---

## 4. Bilmen gereken üç şey

**Ücretsiz plan uyur.** 15 dakika ziyaretçi gelmezse sunucu uykuya geçer,
sonraki ilk ziyaretçi ~30 saniye bekler. Sonrası normal hızında.
İş başvurusu için link paylaşacaksan, paylaşmadan hemen önce siteyi
bir kez kendin aç — uyanık olsun.

**Diskin kalıcı.** Veritabanı ve yüklediğin fotoğraflar `/var/data` altında
duruyor. Yeni sürüm yüklesen bile silinmiyor.

**Kendi alan adın.** `readalallos.com` gibi bir adres alırsan,
Render → **Settings → Custom Domains** üzerinden ücretsiz bağlarsın,
HTTPS sertifikasını kendi hallediyor.

---

## Bir şeyi değiştirmek istersen

- **İçerik** (yazılar, fotoğraflar, linkler) → siten üzerindeki admin paneli.
  GitHub'a dokunmana gerek yok, anında yayında.
- **Tasarım veya kod** → dosyayı GitHub'da düzenle, kaydet.
  Render değişikliği görüp otomatik yeniden yayınlar.

---

## Takılırsan

| Belirti | Sebep |
|---|---|
| Site açılmıyor, "Bad Gateway" | Uyanıyor, 30 sn bekle |
| Deploy kırmızı / "failed" | Render → **Logs** sekmesindeki son satırları bana gönder |
| Admin paneli girişi kabul etmiyor | Environment'taki `ADMIN_PASSWORD` ile birebir aynı mı, boşluk var mı |
| Fotoğraflar kayboldu | Diskin bağlı mı: **Settings → Disks**, `/var/data` görünmeli |
