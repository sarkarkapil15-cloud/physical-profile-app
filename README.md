# Physical_Profile

Mobile app for HR strip physical thickness profile measurement (HE / TE / Body).

## Ei project theke APK banano — step by step

### Step 1: Expo account banano
1. Phone browser e https://expo.dev khol
2. Free account create kor (email diye sign up)

### Step 2: Expo Access Token banano
1. Login korar por, https://expo.dev/accounts/[your-username]/settings/access-tokens e ja
2. "Create token" e click kore ekta token banao
3. Token টা copy kore rakho (eta secret, kaoke dio na)

### Step 3: GitHub Secret e token বসানো
1. Ei repository te giye **Settings → Secrets and variables → Actions** e ja
2. "New repository secret" e click kor
3. Name: `EXPO_TOKEN`
4. Value: (Step 2 er token টা paste kor)
5. Save kor

### Step 4: Build trigger kora
1. Repository er **Actions** tab e ja
2. "Build Android APK" workflow select kor
3. "Run workflow" button e click kore build shuru kor
4. 10-20 minute wait kor — build cloud e (Expo/EAS er server e) hobe

### Step 5: APK download kora
1. Build complete howar por, https://expo.dev e login kore **Builds** section e ja
2. Shesh build ta te click kore **Download** button e APK file পাবে
3. Shei APK file phone e download kore install kor (Unknown Sources allow korte hobe Settings e)
4. APK file WhatsApp/Drive diye onno kaoke o share kora jay — se install korle normal app er moto use korbe

## Notes
- Data shudhu phone er local storage e thake (AsyncStorage) — internet lage na app use korte
- Share button PDF generate kore real share sheet (WhatsApp etc) khole
