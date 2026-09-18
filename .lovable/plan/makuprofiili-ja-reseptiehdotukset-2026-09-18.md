# Makuprofiili ja reseptiehdotukset

AI-apuri oppii tuntemaan käyttäjän maun ja ehdottaa hänelle uusia reseptejä omaan kirjastoon lisättäväksi.

## 1. Makuprofiili (Tili-näkymä + ensikäynnin kysely)

- Uusi "Makuprofiili"-osio Tili-sivulle ja kevyt aloituskysely, joka näytetään kerran, kun profiilia ei vielä ole.
- Käyttäjä valitsee muutamia kuvaavia tageja, esim: kasvispainotteinen, sekasyöjä, vegaani, kala, terveellistä, nopeaa (alle 30 min), uuniruoat, budjetti, mausteinen, lapsiystävällinen, gluteeniton, maidoton.
- Lisäksi vapaa tekstikenttä ("Mitä et syö?" / toiveet) sekä oletusannosmäärä.
- Profiili on aina muokattavissa Tili-sivulta.

## 2. Automaattinen profilointi omista resepteistä

- Painike "Päivitä profiili resepteistäni": AI lukee tallennettujen reseptien nimet, tagit ja raaka-aineet ja tuottaa lyhyen suomenkielisen makukuvauksen (esim. "Suosit kasvispainotteista, nopeaa arkiruokaa, paljon linssejä ja kaurakermaa").
- Kuvaus tallennetaan profiiliin ja näytetään käyttäjälle; käyttäjä voi hyväksyä tai muokata sitä.
- Toimii myös ilman reseptejä – silloin käytetään pelkkiä valittuja tageja.

## 3. Ehdotetut reseptit ("Sinulle"-välilehti Löydä-sivulle)

- Uusi välilehti "Sinulle" nykyisten "Hae verkosta" ja "AI-Reseptiapuri" rinnalle.
- Painike "Ehdota minulle reseptejä" luo profiilin pohjalta 6–8 ehdotusta: nimi, lyhyt kuvaus, aika, annokset ja miksi tämä sopii sinulle.
- Jokaisessa ehdotuksessa: "Näytä resepti" (AI kirjoittaa täyden reseptin) ja "Tallenna Rullaan".
- Ehdotukset eivät toista reseptejä, jotka jo ovat kirjastossa.
- Mahdollisuus tarkentaa: "lisää kasvisruokia", "nopeampia", "uusi haku".

## 4. AI-apuri tuntee profiilin

- Profiili liitetään AI-apurin muistiin joka näkymässä, joten vastaukset ja viikkosuunnittelu noudattavat makutottumuksia automaattisesti.
- Viikon ruokalistan AI-generointi käyttää samaa profiilia.

## Tekniset yksityiskohdat

- Uusi taulu `public.taste_profile` (yksi rivi per käyttäjä): `user_id`, `tags text[]`, `dislikes text`, `default_servings`, `summary text`, `updated_at`. RLS + GRANTit `auth.uid()`-rajauksella, kuten muissa tauluissa.
- Vierastilassa profiili tallennetaan localStorageen (`rullaa.profile`) ja siirretään kirjautumisen yhteydessä osana nykyistä `migrateGuestData`-logiikkaa.
- `src/lib/store.ts`: `useTasteProfile()` ja `useSaveTasteProfile()` samalla Supabase/localStorage-mallilla kuin reseptit.
- `src/lib/ai.functions.ts`: kaksi uutta server functionia — `buildTasteProfile` (yhteenveto omista resepteistä) ja `suggestRecipeIdeas` (ehdotuslista profiilin perusteella). Täyden reseptin kirjoittaminen käyttää olemassa olevaa `generateRecipe`-funktiota.
- `generateWeekPlan` ja `assistantChat` saavat profiilin lisäkenttänä.
- UI: uusi `src/components/TasteProfileDialog.tsx` (aloituskysely + muokkaus), osio `src/routes/tili.tsx`:ssa ja "Sinulle"-välilehti `src/routes/loyda.tsx`:ssä.
