# STFUAI Podcasts

<img align="left" src="https://images.squarespace-cdn.com/content/v1/692c82509c98a067a379beee/f7e07396-0153-45d2-8ff6-1c38e40a284b/icon.png" alt="STFUAI Podcasts Icon" width="100px">[**STFUAI Podcasts**](https://stfuai.com) is a podcast player and manager that automatically skips ads and other skippable segments such as intros, outros, closing credits, and self-promotion segments. 

**STFUAI Podcasts** was built by [Tim Woodruff](https://li.snc.guru); [developer](https://snprotips.com), [author](https://books.snc.guru), and *disliker of intrusive and annoying ads*.

_**STFUAI Podcasts** is short for "**S**kip **T**he **F**\*cking **U**nwanted **A**ds **I**n Podcasts"._

# Download & Install

If you just came here for the download link, you can get the latest release at https://download.stfuai.com. 
If that link doesn't work for you, click [here](https://github.com/thisnameissoclever/STFUAI-Podcasts/releases).

On the latest release, expand the **Assets** section, download `STFUAI-Podcasts-Setup-[version].exe`, and run it to install the STFUAI Podcasts app.

Once you've installed and launched the app, you **MUST** configure your API keys in the Settings page before using the app. 

## Setting up your API keys

This app supports two API keys, but only requires one free API key (for AssemblyAI) to function. The public release version of this app will not require an API key, but will just work for free up to some amount of usage per month, or perhaps with slightly limited ad-skipping functionality, but may have a paid tier to unlock all features and unlimited ad-skipping. 

For now though, you will need to set up at least one API key to use the app, or two for more advanced ad-skipping functionality. 

### AssemblyAI API key (FREE)

AssemblyAI is a transcription service that is used to transcribe podcast audio into diarized text for analysis and basic ad detection. If you only have this and not the OpenAI API key, you will still be able to skip most ads - typically for free!

1. Go to [AssemblyAI](https://assemblyai.com) and sign up for an account.
2. Go to [AssemblyAI Dashboard](https://dashboard.assemblyai.com) and click on the "API" tab.
3. Copy the API key from the dashboard.
4. Open [STFUAI Podcasts](https://stfuai.com) and click on the "Settings" tab.
5. Paste the API key into the "AssemblyAI API Key" field.

This API key is free and will allow you to skip most ads up to a certain (surprisingly large) amount of free usage per month. 

The public release version of this app will automatically include an AssemblyAI API key for free up to some amount of usage per month. 

### OpenAI API key (OPTIONAL, enables advanced ad detection)

OpenAI is an AI service that is used to detect skippable segments in your favorite podcasts. If you don't have this, you will still be able to skip most ads - typically for free!

1. Go to [OpenAI](https://openai.com) and sign in (or sign up for an account if you don't have one).
2. Go to [OpenAI Dashboard](https://platform.openai.com) and click on the "API" tab.
3. Copy the API key from the dashboard.
4. Open [**STFUAI Podcasts**](https://stfuai.com) and click on the "Settings" tab.
5. Paste the API key into the "OpenAI API Key" field.

The public release version of this app will automatically include an OpenAI API key for free up to some amount of usage per month.

(*TODO: Update instructions to include screenshots*)

# Get in touch

If you have any questions, feature requests, bug reports, or you just want to hang out with some fellow podcast-enjoyers, join us in the [Discord server](https://discord.stfuai.com)! 

# Demo videos & Screenshots

<div align="center">
  <video src="https://github.com/user-attachments/assets/2420e215-af68-48ea-8c75-5c45aacef083" width="540" controls></video>
</div>
<div align="center">
  <img width="32%" alt="full ui 1" src="https://github.com/user-attachments/assets/46b073fc-7a88-4b88-be9b-7e07e767c538" />
  <img width="32%" alt="skippable segments" src="https://github.com/user-attachments/assets/8121897e-1299-4583-b4fc-27e22ea5641a" />
  <img width="32%" alt="transcript ui and skip to word" src="https://github.com/user-attachments/assets/a18b0797-b4c2-49f2-be92-33827ea8e456" />
</div>

---

(*TODO: Add more info here before launching v1.*)