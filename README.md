# Syndicate Booster Bot

## Ce face acest bot?

- Te ajută să crești volumul pe un token Solana, automat.
- Poți să-ți administrezi wallet-ul, să retragi fonduri și să vezi statistici.
- Are sistem de referral și boostere pentru volume, rank și holders.

---

## Cum îl pornești?

1. **Descarcă codul** (sau clonează repo-ul).
2. **Instalează Node.js** (dacă nu ai deja).
3. **Deschide terminalul** și scrie:
   ```bash
   npm install
   ```
4. **Copiază `.env.example` în `.env`** și completează cu datele tale (token Telegram, URL MongoDB, etc).
5. **Pornește botul:**
   ```bash
   npm run start
   ```

---

## Cum îl folosești?

- Intră pe Telegram și caută botul tău.
- Scrie `/start` și urmează instrucțiunile.
- Poți folosi butoanele din meniu pentru:
  - **Boost volume**: crește volumul pe tokenul tău.
  - **My wallet**: vezi și administrează fondurile.
  - **Referrals**: vezi și invită prieteni.

---

## Pentru dezvoltatori

- Codul e scris în TypeScript.
- Folosește Prisma pentru MongoDB.
- Poți adăuga comenzi noi în folderul `src/commands/`.
- Poți adăuga funcții noi în `src/actions/` sau `src/utils/`.

---

## Întrebări frecvente

- **Nu merge botul!**  
  Verifică dacă ai completat corect `.env` și dacă ai pornit MongoDB.

- **Cum adaug un admin?**  
  Adaugă ID-ul Telegram în lista din `UserManager.ts` la `_unconditionalAdmins`.

- **E sigur?**  
  Cheile private sunt stocate în DB, recomandăm să folosești criptare suplimentară.

---

## Contact

- Telegram: [@SpiryBTC](https://t.me/SpiryBTC)
- Pentru bug-uri, deschide un issue pe GitHub.

---

