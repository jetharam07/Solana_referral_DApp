"use client";

import { useState, useEffect, useMemo } from 'react';
import { Connection, PublicKey, SystemProgram } from '@solana/web3.js';
import { Program, AnchorProvider } from '@coral-xyz/anchor';
import { useWallet, useConnection, useAnchorWallet } from '@solana/wallet-adapter-react';
import { useSearchParams } from 'next/navigation';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';

// @ts-ignore
import idl from '../constants/referral_reward.json';

const ADMIN_PUBKEY = new PublicKey("HQpcApEUAMdJNcQ3HGmnzzWNpjJf1DGuAbXXTMXRdX4n");

export default function Dashboard() {

/* Initializes the connection to the Solana blockchain and extracts wallet methods. 'connection' handles network requests, while 'publicKey' and 'connected' manage the user's current wallet session and identity.
*/

    const { connection } = useConnection();
    const { select, connected, disconnect, publicKey } = useWallet();
    const anchorWallet = useAnchorWallet();
    const searchParams = useSearchParams();

    const [isAdminView, setIsAdminView] = useState(false);
    const [allUsers, setAllUsers] = useState([]);
    const [userAccount, setUserAccount] = useState(null);
    const [globalState, setGlobalState] = useState(null);
    const [vaultBalance, setVaultBalance] = useState("0");
    const [loading, setLoading] = useState(false);
    const [userName, setUserName] = useState("");
    const [selectedUser, setSelectedUser] = useState(null);
    const [notification, setNotification] = useState({ msg: '', type: '' });

   
    const [showRegisterModal, setShowRegisterModal] = useState(false);
    const [isRegistering, setIsRegistering] = useState(false);
    const [isClaiming, setIsClaiming] = useState(false);
    const [rewardingUser, setRewardingUser] = useState(null);

    const programId = new PublicKey(idl.address);
    const urlRef = searchParams.get('ref');

    /* Calculates the total number of referrals for the connected user. It filters the 'allUsers' list by comparing each user's referrer address 
   with the current wallet's public key and returns the count.
   */
   
    const myReferralCount = useMemo(() => {
        if (!publicKey || allUsers.length === 0) return 0;
        return allUsers.filter(u => u.account.referrer.toBase58() === publicKey.toBase58()).length;
    }, [allUsers, publicKey]);

    const formatTokens = (lamports: any) => {
        if (!lamports) return "0.00";
        return (Number(lamports) / 1_000_000_000).toFixed(2);
    };

    const notify = (msg: string, type: 'success' | 'error') => {
        setNotification({ msg, type });
        setTimeout(() => setNotification({ msg: '', type: '' }), 4000);
    };

    const program = useMemo(() => {
        if (!anchorWallet) return null;
        const provider = new AnchorProvider(connection, anchorWallet, { commitment: "confirmed" });
        return new Program(idl as any, provider);
    }, [anchorWallet, connection]);

   
    useEffect(() => {
        if (program) {
            fetchInitialData();
            if (connected) fetchData();
        }
    }, [connected, program]);

    const fetchInitialData = async () => {
        if (!program) return;
        try {
            const users = await program.account.userAccount.all();
            const sortedUsers = users.sort((a, b) => b.account.joinedAt.toNumber() - a.account.joinedAt.toNumber());
            setAllUsers(sortedUsers);
        } catch (e) { console.error(e); }
    };


/* Synchronizes the DApp with the blockchain by deriving PDAs for the Global State, Vault, and User Account using specific seeds. 
   It fetches real-time protocol settings, reward balances, and individual user data directly from the Solana ledger. 
   The function includes error handling to manage uninitialized accounts and uses a loading state to ensure a smooth UI experience.
*/
    const fetchData = async () => {
        if (!program || !publicKey) return;
        try {
            setLoading(true);
            const [statePDA] = PublicKey.findProgramAddressSync([Buffer.from("state")], programId);
            const stateData = await program.account.globalState.fetch(statePDA);
            setGlobalState(stateData);

            const [vaultPDA] = PublicKey.findProgramAddressSync([Buffer.from("vault")], programId);
            try {
                const vBal = await connection.getTokenAccountBalance(vaultPDA);
                setVaultBalance(vBal.value.uiAmountString || "0");
            } catch (e) { setVaultBalance("0"); }

            const [userPDA] = PublicKey.findProgramAddressSync([Buffer.from("user"), publicKey.toBuffer()], programId);
            try {
                const userData = await program.account.userAccount.fetch(userPDA);
                setUserAccount(userData);
            } catch (e) { setUserAccount(null); }
        } catch (err) { console.error(err); } finally { setLoading(false); }
    };


    /* Executes the user registration process by deriving a unique User PDA and sending a transaction to the Solana program. 
   It captures the referrer's address from the URL (falling back to a default key if absent) and invokes the 'registerUser' instruction. 
   Upon success, it triggers a UI notification, closes the registration modal, and refreshes the local state to reflect the new account data.
*/
    const handleRegister = async () => {
        if (!userName || !program || !publicKey) return notify("Enter name!", "error");
        try {
            setIsRegistering(true);
            const referrer = urlRef ? new PublicKey(urlRef) : PublicKey.default;
            const [userPDA] = PublicKey.findProgramAddressSync([Buffer.from("user"), publicKey.toBuffer()], programId);

            await program.methods.registerUser(userName, referrer).accounts({
                userAccount: userPDA,
                user: publicKey,
                systemProgram: SystemProgram.programId,
            } as any).rpc();

            notify("Identity Activated! 🚀", "success");
            setShowRegisterModal(false);
            await fetchData();
            await fetchInitialData(); // Refresh list to update count
        } catch (e) {
            console.error(e);
            notify("Registration Failed", "error");
        } finally {
            setIsRegistering(false);
        }
    };


    /* Facilitates the reward withdrawal process by transferring earned tokens from the program's Vault to the user's Associated Token Account (ATA). 
   It dynamically derives the necessary PDAs (State, Vault, User) and ensures the user's token account is ready to receive the specific mint tokens. 
   Once the RPC call 'claimReward' succeeds, it triggers a success notification and refreshes the dashboard data.
*/
    const handleClaim = async () => {
        if (!program || !userAccount || !publicKey) return;
        try {
            setIsClaiming(true);
            const [statePDA] = PublicKey.findProgramAddressSync([Buffer.from("state")], programId);
            const [vaultPDA] = PublicKey.findProgramAddressSync([Buffer.from("vault")], programId);
            const [userPDA] = PublicKey.findProgramAddressSync([Buffer.from("user"), publicKey.toBuffer()], programId);
            const userAta = await getAssociatedTokenAddress(globalState.mint, publicKey);

            await program.methods.claimReward().accounts({
                globalState: statePDA, userAccount: userPDA, vaultAccount: vaultPDA,
                userTokenAccount: userAta, user: publicKey, mint: globalState.mint,
                tokenProgram: TOKEN_PROGRAM_ID, associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                systemProgram: SystemProgram.programId,
            } as any).rpc();
            notify("Tokens Claimed!", "success");
            fetchData();
        } catch (e: any) { notify("Claim Failed", "error"); } finally { setIsClaiming(false); }
    };

    const handleCompleteAction = async (targetWallet, referrerWallet, userId) => {
        if (!program || publicKey?.toBase58() !== ADMIN_PUBKEY.toBase58()) return;
        try {
            setRewardingUser(userId);
            const [l1PDA] = PublicKey.findProgramAddressSync([Buffer.from("user"), targetWallet.toBuffer()], programId);
            const isSystemRef = referrerWallet.toBase58() === "11111111111111111111111111111111";
            const refToUse = isSystemRef ? targetWallet : referrerWallet;
            const [l2PDA] = PublicKey.findProgramAddressSync([Buffer.from("user"), refToUse.toBuffer()], programId);
            const [statePDA] = PublicKey.findProgramAddressSync([Buffer.from("state")], programId);

            await program.methods.completeAction().accounts({
                globalState: statePDA, l1Account: l1PDA, l2Account: l2PDA, authority: publicKey,
            } as any).rpc();

            notify("Reward Distributed!", "success");
            await fetchInitialData();
        } catch (e) { notify("Reward Error!", "error"); } finally { setRewardingUser(null); }
    };

    const copyAddress = () => {
        if (publicKey) {
            navigator.clipboard.writeText(publicKey.toBase58());
            notify("Address Copied!", "success");
        }
    };



    return (

        <div className="min-h-screen bg-[#020617] text-slate-200 p-6 font-sans">

 {/* A global notification component that triggers on 'notification.msg' updates. It uses Tailwind's 'animate-in' for smooth entry and dynamically changes color (Emerald for success, Rose for error) based on the transaction outcome. */}

            {notification.msg && (
                <div className={`fixed top-10 right-10 z-[100] animate-in fade-in zoom-in duration-300 p-5 rounded-2xl shadow-2xl backdrop-blur-xl border ${notification.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' : 'bg-rose-500/10 border-rose-500/50 text-rose-400'}`}>
                    <p className="font-black uppercase tracking-widest text-sm flex items-center gap-3">
                        <span className="h-2 w-2 rounded-full bg-current animate-pulse"></span> {notification.msg}
                    </p>
                </div>
            )}

{/* The main navigation header featuring 'SecureChainAi' branding and a sticky backdrop-blur effect. It includes a 'Toggle View' button that allows authorized developers/admins to switch between the User Dashboard and the Administrative Management interface. */}
            <header className="flex flex-wrap justify-between items-center bg-[#0f172a]/80 backdrop-blur-xl p-6 rounded-[2.5rem] border border-slate-800 shadow-2xl mb-10 sticky top-0 z-40 max-w-[1400px] mx-auto">
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 bg-sky-500 rounded-2xl flex items-center justify-center font-black text-white text-xl shadow-[0_0_20px_rgba(14,165,233,0.3)]">S</div>
                    <h1 className="text-2xl font-black uppercase italic tracking-tighter">Secure<span className="text-sky-500">ChainAi</span></h1>
                </div>

                <div className="flex items-center gap-4 relative">
                    <button onClick={() => setIsAdminView(!isAdminView)} className="bg-slate-800/40 hover:bg-slate-700 border border-slate-700 px-5 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all">
                        {isAdminView ? "SWITCH TO USER" : "SWITCH TO ADMIN"}
                    </button>

                     {/* A sophisticated wallet selection system that conditionally renders based on the connection state. If disconnected, it displays a custom dropdown to choose between Phantom or Solflare wallets, complete with auto-redirection to their official websites if the extensions are missing. */}
                    {!connected ? (
                        <div className="relative group">
                            {/* Main Connect Button */}
                            <button className="bg-sky-500 hover:bg-sky-400 text-black px-6 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all shadow-lg shadow-sky-500/20">
                                Connect Wallet
                            </button>

                            {/* Dropdown  */}
                            <div className="absolute top-full right-0 mt-2 w-48 bg-[#0f172a] border border-slate-800 rounded-2xl p-2 shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                                <button
                                    onClick={() => {
                                        if (window?.phantom?.solana) select('Phantom' as any);
                                        else window.open('https://phantom.app/', '_blank');
                                    }}


                                    className="w-full flex items-center justify-between hover:bg-[#AB9FF2]/10 p-3 rounded-xl transition-colors group/p"
                                >
                                    <span className="text-[11px] font-black uppercase text-slate-300 group-hover/p:text-[#AB9FF2]">Phantom</span>
                                    <div className="w-2 h-2 rounded-full bg-[#AB9FF2]"></div>
                                </button>

                                <button
                                    onClick={() => {
                                        if (window?.solflare) select('Solflare' as any);
                                        else window.open('https://solflare.com/', '_blank');
                                    }}
                                    className="w-full flex items-center justify-between hover:bg-[#FC814A]/10 p-3 rounded-xl transition-colors group/s"
                                >
                                    <span className="text-[11px] font-black uppercase text-slate-300 group-hover/s:text-[#FC814A]">Solflare</span>
                                    <div className="w-2 h-2 rounded-full bg-[#FC814A]"></div>
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-center gap-3 bg-black/40 p-1.5 pl-4 rounded-2xl border border-slate-800">
                            <span className="text-[10px] font-mono text-sky-400 font-bold italic">
                                {publicKey?.toBase58().slice(0, 4)}...{publicKey?.toBase58().slice(-4)}
                            </span>
                            <button onClick={disconnect} className="bg-rose-900/20 hover:bg-rose-900/40 text-rose-500 border border-rose-500/30 px-4 py-2 rounded-xl text-[10px] font-black uppercase italic transition-all">
                                Disconnect
                            </button>
                        </div>
                    )}
                </div>
            </header>

            {/* Displays high-level protocol statistics using the 'StatCard' component. It shows the current balance in the reward Vault and the total number of registered users fetched from the global state. */}

            <div className="flex flex-col lg:flex-row gap-8 max-w-[1400px] mx-auto">
                <main className="flex-1 space-y-8">
                    {isAdminView ? (
                        <div className="space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <StatCard title="Vault Total" value={vaultBalance} sub="Tokens" color="text-pink-400" />
                                <StatCard title="Active Users" value={globalState?.totalUsers.toString() || "0"} sub="Members" color="text-sky-400" />
                            </div>
                            <div className="bg-[#0f172a] p-10 rounded-[3rem] border border-slate-800 shadow-xl">
                                <h3 className="text-[10px] font-black text-slate-500 mb-8 uppercase tracking-[0.4em]">Protocol Architecture</h3>
                               


                                <div className="grid gap-6 mt-4">
                                    {[
                                        {
                                            label: "Vault Address",
                                            val: PublicKey.findProgramAddressSync([Buffer.from("vault")], programId)[0].toBase58()
                                        },
                                        {
                                            label: "Global State PDA",
                                            val: PublicKey.findProgramAddressSync([Buffer.from("state")], programId)[0].toBase58()
                                        },
                                        {
                                            label: "Reward Mint",
                                            val: globalState?.mint.toBase58() || "---"
                                        }
                                    ].map((item, idx) => (
                                        <div key={idx} className="flex flex-col gap-2 group">
                                            {/* Label  */}
                                            <span className="text-slate-600 text-[9px] uppercase font-black tracking-[0.15em] pl-1 italic">
                                                {item.label}
                                            </span>

                                            {/* Address Box - */}
                                            <div
                                                onClick={() => {
                                                    if (item.val !== "---") {
                                                        navigator.clipboard.writeText(item.val);
                                                        notify(`${item.label} Copied!`, "success");
                                                    }
                                                }}
                                                className="relative flex items-center bg-slate-950/40 border border-slate-800/60 p-3 rounded-2xl cursor-pointer hover:border-sky-500/40 hover:bg-slate-900/60 transition-all group/box"
                                            >
                                                {/* Value - Text size (11px) and Monospace */}
                                                <p className="text-[11px] font-mono text-slate-400 group-hover/box:text-sky-100 break-all italic pr-10 leading-tight">
                                                    {item.val}
                                                </p>

                                                {/* Copy Icon - Right side aligned */}
                                                <div className="absolute right-3 opacity-30 group-hover/box:opacity-100 transition-opacity">
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                    </svg>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                            </div>
                        </div>
                    ) : (
                        <div className="space-y-8">

 {/* Displays the user's reward statistics, including pending and total earned tokens. If 'pendingRewards' are greater than zero, it renders a 'Claim' button that triggers the on-chain withdrawal process with a loading state. */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="relative group">
                                    <StatCard title="Pending" value={formatTokens(userAccount?.pendingRewards)} sub="Tokens" color="text-yellow-400" />
                                    {connected && userAccount?.pendingRewards.toNumber() > 0 && (
                                        <button disabled={isClaiming} onClick={handleClaim} className="absolute bottom-6 right-6 bg-yellow-400 text-black text-[10px] font-black px-4 py-2 rounded-xl shadow-2xl active:scale-95 disabled:opacity-50 flex items-center gap-2">
                                            {isClaiming && <span className="w-3 h-3 border-2 border-black border-t-transparent rounded-full animate-spin"></span>}
                                            {isClaiming ? "CLAIMING..." : "CLAIM"}
                                        </button>
                                    )}
                                </div>
                                <StatCard title="Total Claimed" value={formatTokens(userAccount?.totalEarned.sub(userAccount?.pendingRewards || 0))} sub="Tokens" color="text-emerald-400" />

                                <StatCard title="Direct Refs" value={myReferralCount.toString()} sub="Users" color="text-sky-400" />
                            </div>
                            <div className="bg-[#0f172a] p-10 rounded-[3rem] border border-slate-800 shadow-xl">
                                <h3 className="text-[10px] font-black text-slate-500 mb-8 uppercase tracking-[0.4em]">Personal Identity</h3>
                                <div className="grid md:grid-cols-2 gap-12">

                                    <div className="flex flex-col justify-center -mt-4">
                                        <span className="text-slate-600 text-[10px] uppercase font-black tracking-widest mb-1 italic">
                                            Verified Identity
                                        </span>

                                        {userAccount ? (
                                            <div className="space-y-2.5">
                                                {/* Name Section */}
                                                <div className="flex flex-col">
                                                    <span className="font-black text-white text-2xl break-all italic tracking-tighter leading-tight">
                                                        {userAccount.name}
                                                    </span>
                                                </div>

                                                {/* Address & Date Section */}
                                                <div className="flex flex-wrap gap-3 items-center">
                                                    {/* Clickable/Copyable Wallet Address */}
                                                    <button
                                                        onClick={copyAddress}
                                                        title="Click to copy address"
                                                        className="bg-slate-800/40 border border-slate-700/50 px-3 py-1.5 rounded-xl flex items-center gap-2 hover:bg-slate-700/60 transition-all active:scale-95 group"
                                                    >
                                                        <div className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse"></div>
                                                        <span className="text-[11px] font-mono text-slate-400 group-hover:text-sky-400">
                                                            {publicKey?.toBase58().slice(0, 6)}...{publicKey?.toBase58().slice(-4)}
                                                        </span>
                                                        {/* Copy Icon */}
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-slate-500 group-hover:text-sky-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="Link8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                        </svg>
                                                    </button>

                                                    {/* Joined Date */}
                                                    <div className="flex flex-col border-l border-slate-800 pl-3">
                                                        <span className="text-[8px] text-slate-500 uppercase font-bold tracking-tighter">Joined Since</span>
                                                        <span className="text-[12px] text-sky-400 font-black">
                                                            {new Date(userAccount.joinedAt.toNumber() * 1000).toLocaleDateString('en-GB', {
                                                                day: 'numeric',
                                                                month: 'long',
                                                                year: 'numeric'
                                                            })}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="mt-1">
                                                <p className="text-slate-500 text-sm mb-3 italic">No Identity Found</p>
                                                <button
                                                    disabled={!connected}
                                                    onClick={() => setShowRegisterModal(true)}
                                                    className="bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/30 px-6 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all disabled:opacity-30"
                                                >
                                                    {connected ? "Register Now" : "Connect Wallet First"}
                                                </button>
                                            </div>
                                        )}
                                    </div>


                     {/* Highlighting the Referral Reward: A floating badge and header to inform users about the 30% commission they earn through the affiliate system.  */}

                                    <div className="bg-gradient-to-br from-slate-900 to-[#0f172a] p-8 rounded-[2.5rem] border border-slate-800 relative overflow-hidden group shadow-2xl">

                                        {/*  Top Badge: 30% Reward Highlight */}
                                        <div className="absolute -top-1 -right-1 bg-gradient-to-r from-amber-500 to-orange-600 text-black text-[10px] font-black px-4 py-2 rounded-bl-2xl shadow-lg z-10 animate-pulse">
                                            EARN 30% REWARD
                                        </div>

                                        <div className="relative z-20">
                                            <p className="text-[10px] font-black text-sky-500 uppercase mb-2 tracking-[0.3em] text-center">Affiliate System</p>
                                            <h4 className="text-white text-lg font-black text-center uppercase italic mb-6 tracking-tighter">Multiply Your Growth</h4>

                                            <div className="space-y-4">
                                                {/* Link Box */}
                                                <div className="relative group/link">
                                                    <code className="block bg-black/60 p-5 rounded-2xl text-slate-300 text-[12px] break-all border border-slate-800/50 font-mono text-center transition-all group-hover/link:border-sky-500/50">
                                                        {userAccount ? (
                                                            <span className="text-sky-400 italic">
                                                                {window.location.origin}?ref={publicKey?.toBase58().slice(0, 8)}...
                                                            </span>
                                                        ) : (
                                                            <span className="text-rose-500/50">IDENTITY NOT ACTIVE</span>
                                                        )}
                                                    </code>



                                                    {/* Glow Effect on Hover */}
                                                    <div className="absolute inset-0 bg-sky-500/5 blur-xl rounded-full opacity-0 group-hover/link:opacity-100 transition-opacity"></div>
                                                </div>

                                                {/* Benefit Info */}
                                                <div className="flex items-center justify-between px-2 py-1">
                                                    <div className="flex flex-col">
                                                        <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Commission</span>
                                                        <span className="text-white font-bold text-sm">30% Instant</span>
                                                    </div>
                                                    <div className="h-8 w-[1px] bg-slate-800"></div>
                                                    <div className="flex flex-col items-end">
                                                        <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest">Network</span>
                                                        <span className="text-white font-bold text-sm">Unlimited</span>
                                                    </div>
                                                </div>

                                                {/* Action Button */}
                                                <button
                                                    disabled={!userAccount}
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(`${window.location.origin}?ref=${publicKey?.toBase58()}`);
                                                        notify("Link Copied!", "success")
                                                    }}
                                                    className="w-full bg-sky-600 hover:bg-sky-500 text-white font-black py-5 rounded-2xl text-[11px] uppercase tracking-[0.2em] shadow-xl shadow-sky-900/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:grayscale flex items-center justify-center gap-3 group/btn"
                                                >
                                                    <span>Copy Invite Link</span>
                                                    <svg className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>

                                        {/* Subtle Background Icon */}
                                        <div className="absolute -bottom-6 -left-6 text-slate-800/20 text-8xl font-black rotate-12 pointer-events-none group-hover:text-sky-500/5 transition-colors">
                                            $
                                        </div>
                                    </div>

                                </div>
                            </div>
                        </div>
                    )}
                </main>

                {/* The 'User Matrix' acts as the primary directory for all protocol members. It maps through the 'allUsers' array to generate individual profile cards, providing a quick overview of their status and earnings. */}

                <aside className="w-full lg:w-[450px] bg-[#0f172a] rounded-[3rem] border border-slate-800 p-8 h-[780px] flex flex-col shadow-2xl    relative overflow-hidden">
                    <h3 className="font-black text-white text-[12px] tracking-[0.3em] uppercase italic border-b border-slate-800/50 pb-6 mb-6">User Matrix</h3>

                    <div className="overflow-y-auto flex-1 space-y-4 custom-scroll pr-2">
                        {allUsers.map((u, i) => (
                            <div key={i} className="bg-[#1e293b]/30 p-6 rounded-[2rem] border border-slate-800 hover:border-sky-500/40 transition-all group">
                                <div className="flex justify-between items-center mb-1">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <p className="font-black text-white text-[17px] tracking-tight">{u.account.name}</p>

                                            {u.account.totalEarned.toNumber() > 0 ? (
                                                <span className="text-emerald-500 text-sm font-bold" title="Action Completed">✓</span>
                                            ) : (
                                                <span className="w-2 h-2 rounded-full bg-slate-700" title="Not Rewarded Yet"></span>
                                            )}
                                        </div>


                                        <p className="text-[11px] text-slate-500 font-mono mt-1">{u.publicKey.toBase58().slice(0, 14)}...</p>
                                    </div>

                                    <div className="flex gap-2">
                                        <button onClick={() => setSelectedUser(u)} className="bg-slate-800 text-slate-400 p-2 rounded-xl text-[10px] font-black uppercase opacity-0 group-hover:opacity-100 transition-all">View</button>

                                        {isAdminView && (
                                            // firstly check wallet is connected or not
                                            publicKey?.toBase58() === ADMIN_PUBKEY.toBase58() ? (
                                            
                                                u.account.totalEarned.toNumber() === 0 ? (
                                                    <button
                                                        disabled={rewardingUser === u.publicKey.toBase58()}
                                                        onClick={() => handleCompleteAction(u.account.wallet, u.account.referrer, u.publicKey.toBase58())}
                                                        className="bg-sky-500 text-black p-2 rounded-xl text-[10px] font-black uppercase opacity-0 group-hover:opacity-100 transition-all flex items-center gap-1"
                                                    >
                                                        {rewardingUser === u.publicKey.toBase58() && <span className="w-2 h-2 border border-black border-t-transparent rounded-full animate-spin"></span>}
                                                        {rewardingUser === u.publicKey.toBase58() ? "..." : "Reward"}
                                                    </button>
                                                ) : (
                                                    <div className="bg-emerald-500/10 text-emerald-500 px-3 py-1 rounded-lg text-[9px] font-black uppercase border border-emerald-500/20">Rewarded ✓</div>
                                                )
                                            ) : (
                                                // show error, if admin is not available
                                                <button
                                                    onClick={() => notify("Access Denied: Admin Only", "error")}
                                                    className="bg-rose-500/10 text-rose-500 border border-rose-500/20 p-2 rounded-xl text-[10px] font-black uppercase opacity-0 group-hover:opacity-100 transition-all"
                                                >
                                                    Locked 🔒
                                                </button>
                                            )
                                        )}

                                    </div>
                                </div>
                            </div>
                        )
                        )
                        }

                    </div>
                     {/* High-Z-index Overlay: Uses 'backdrop-blur-3xl' and Tailwind's 'animate-in' for a smooth, modern feel. It takes over the sidebar view to focus on a single user's report. */}


                    {selectedUser && (
                        <div className="absolute inset-0 bg-[#020617]/98 backdrop-blur-3xl z-50 flex flex-col p-10 animate-in fade-in zoom-in-95 duration-200">
                            <button onClick={() => setSelectedUser(null)} className="self-end text-3xl font-light text-slate-500 hover:text-white">✕</button>
                            <div className="flex-1 flex flex-col items-center justify-center">
                                <div className="w-24 h-24 bg-gradient-to-tr from-sky-400 to-blue-600 rounded-[2rem] flex items-center justify-center text-4xl mb-6 shadow-2xl rotate-3">👤</div>
                                <h4 className="text-3xl font-black text-white uppercase italic mb-2 tracking-tighter">{selectedUser.account.name}</h4>
                                <p className="text-[11px] font-mono text-slate-600 mb-10 text-center break-all px-8 uppercase">{selectedUser.publicKey.toBase58()}</p>
                                <div className="w-full space-y-3">
                                    <ReportLine label="Joined Matrix" value={new Date(selectedUser.account.joinedAt.toNumber() * 1000).toLocaleDateString()} />
                                    <ReportLine label="Pending Reward" value={formatTokens(selectedUser.account.pendingRewards) + " Tokens"} highlight="text-yellow-400" />
                                    <ReportLine label="Total Rewarded" value={formatTokens(selectedUser.account.totalEarned) + " Tokens"} highlight="text-emerald-400" />
                                </div>
                                <button onClick={() => setSelectedUser(null)} className="mt-4 w-full border border-slate-800 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest text-slate-500 hover:bg-white hover:text-black transition-all">Close Report</button>
                            </div>
                        </div>
                    )}
                </aside>
            </div>
             {/* Fixed Overlay:  Uses 'z-[100]' to sit on top of all dashboard elements. The 'backdrop-blur-3xl' creates a premium frosted glass effect, 
   hiding the background complexity during onboarding. */}

            {showRegisterModal && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-3xl flex items-center justify-center z-[100] p-6 animate-in fade-in duration-300">
                    <div className="bg-[#0f172a] w-full max-w-lg rounded-[3.5rem] border border-slate-800 p-12 shadow-3xl text-center relative">

                        {/* CLOSE BUTTON (X) - see dashboard for user*/}
                        <button
                            onClick={() => setShowRegisterModal(false)}
                            className="absolute top-8 right-10 text-slate-500 hover:text-white transition-colors text-xl"
                        >
                            ✕
                        </button>

                        <h2 className="text-4xl font-black text-white uppercase italic tracking-tighter mb-10">Create Your Profile</h2>

                        <input
                            type="text"
                            placeholder="ENTER USERNAME..."
                            value={userName}
                            onChange={(e) => setUserName(e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-8 py-5 text-white font-black text-center mb-8 focus:border-sky-500 outline-none text-xl tracking-widest"
                        />

                        <button
                            disabled={isRegistering}
                            onClick={handleRegister}
                            className="w-full bg-sky-600 hover:bg-sky-500 py-6 rounded-3xl text-white font-black uppercase tracking-[0.3em] shadow-2xl shadow-sky-600/40 transition-all active:scale-95 flex justify-center items-center gap-4"
                        >
                            {isRegistering && <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>}
                            {isRegistering ? "REGISTERING..." : "Register On-Chain"}
                        </button>

                        <p className="mt-6 text-[10px] text-slate-500 uppercase tracking-widest font-bold text-center">
                            Registration requires a one-time blockchain transaction
                        </p>
                    </div>
                </div>
            )}

{/* Custom Scrollbar Branding: Overrides the default browser scrollbar for elements with the '.custom-scroll' class. It uses a thin (4px) width to keep the interface clean and professional, ensuring it doesn't distract from the main content. */}
            <style jsx global>{`
                .custom-scroll::-webkit-scrollbar { width: 4px; }
                .custom-scroll::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 10px; }
                .custom-scroll::-webkit-scrollbar-thumb:hover { background: #38bdf8; }
            `}</style>
        </div>
    );
}

// Reusable Metric Card: Displays a specific data point with a title, a large highlighted value, and a subtitle (unit). It centralizes the styling for all dashboard statistics to maintain UI consistency.

function StatCard({ title, value, sub, color }) {
    return (

        <div className="bg-[#0f172a] p-6 rounded-[2rem] border border-slate-800 shadow-xl group hover:border-slate-700 transition-all duration-300 relative overflow-hidden">
            <p className="text-[11px] text-slate-500 uppercase font-black tracking-[0.3em] mb-3 italic opacity-80">
                {title}
            </p>
            <div className="flex items-baseline gap-2">
                <p className={`text-4xl font-black ${color} tracking-tighter transition-transform group-hover:scale-105`}>
                    {value || "0.00"}
                </p>
                <p className="text-[11px] text-slate-600 font-bold uppercase tracking-wider">
                    {sub}
                </p>
            </div>

            <div className="absolute -right-4 -bottom-4 w-12 h-12 bg-white/5 rounded-full blur-2xl group-hover:bg-sky-500/10 transition-colors"></div>
        </div>
        
    );
}


// Data Presentation Helper: A sub-component designed for structural clarity. It stacks a label above its corresponding value, making high-density data (like PDA addresses) easy to scan in the admin or user views.
function DetailRow({ label, value }) {
    return (
        <div className="flex flex-col border-b border-slate-800/40 pb-6">
            <span className="text-slate-600 text-[10px] uppercase font-black tracking-widest mb-2">{label}</span>
            <span className="font-bold text-white text-xl break-all font-mono italic">{value}</span>
        </div>
    );
}

// Horizontal Metric Row: Ideal for modals and summary reports with dynamic highlighting 
function ReportLine({ label, value, highlight = "text-white" }) {
    return (
        <div className="flex justify-between items-center bg-white/5 p-5 rounded-2xl border border-white/5 hover:bg-white/10 transition-colors">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</span>
            <span className={`text-base font-black ${highlight}`}>{value}</span>
        </div>
    );
}

